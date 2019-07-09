const firebase = require("firebase");
const {admin, db} = require('../util/admin');
const config = require('../util/config');
const {validateData, reduceUserDetails} = require('../helpers');

firebase.initializeApp(config);
exports.signUp = (req, res) => {
    const newUser = {
        email: req.body.email,
        password: req.body.password,
        confirmPassword: req.body.confirmPassword,
        handler: req.body.handler,
    };

     const {errors, valid} = validateData(newUser);

     const img = 'noimage.png';

     if(!valid) return res.json(errors);
    //TODO Add errors for password
    let tokenCredential, userId;
    db.doc(`/users/${newUser.handler}`).get()
        .then(doc => {
            if (doc.exists) {
                return res.status(400).json({handler: 'error'})
            } else {
                return firebase.auth().createUserWithEmailAndPassword(newUser.email, newUser.password)
            }
        }).then(data => {
        userId = data.user.uid;
        return data.user.getIdToken();
    }).then(token => {
        tokenCredential = token;
        const addUser = {
            handler: newUser.handler,
            email: newUser.email,
            created: new Date().toISOString(),
            userImg: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${img}?alt=media`,
            userId: userId
        };
        return db.doc(`/users/${newUser.handler}`).set(addUser)
    }).then(() => {
        return res.status(201).json({token: tokenCredential});
    }).catch(err => {
        if(err.code === 'auth/email-already-in-use'){
            return res.status(400).json({Error: 'email already in use'});
        } else {
            console.log(`${err}`);
            return res.status(400).json({error: err.code})
        }
    });
};

exports.login = (req,res) => {
    const userCreds = {
        email: req.body.email,
        password: req.body.password
    };

    //TODO Add validation

    firebase.auth().signInWithEmailAndPassword(userCreds.email,userCreds.password).then(data => {
        return data.user.getIdToken();
    }).then( token => {
        return res.json({token})
    }).catch( err => res.status(400).json(err.code))

};

exports.uploadImage = (req,res) => {
    const BusBoy = require('busboy');
    const path = require('path');
    const os = require('os');
    const fs = require('fs');

    let imageFileName;
    let imgToBeUploaded = {};

    const busboy = new BusBoy({headers: req.headers});
    busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
        //
        // if (mimetype !== 'image/png' || mimetype !== 'image/jpg') {
        //     return res.status(400).json({error: 'Please upload a image'});
        // }


        const imgExtension = filename.split('.')[filename.split('.').length - 1];
        imageFileName = `${Math.round(Math.random() * 1000000) + 4}.${imgExtension}`;
        const filePath = path.join(os.tmpDir(), imageFileName);
        imgToBeUploaded = {filePath, mimetype};
        file.pipe(fs.createWriteStream(filePath));

    });

        busboy.on('finish', () => {
            admin.storage().bucket().upload(imgToBeUploaded.filePath, {
                resumable: false,
                metadata: {
                    metadata: {
                        contentType: imgToBeUploaded.mimetype
                    }
                }
            }).then(() => {
            console.log('WE UP IN THEEEE')
                const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFileName}?alt=media`;
                return db.doc(`/users/${req.user.handler}`).update({imageUrl})
            }).then(() => res.json({message: 'Image uploaded.'}))
                .catch(err => res.status(500).json({error: err.code}))
        });
    busboy.end(req.rawBody);
};

exports.addUserDetails = (req,res) => {
    let userDeatils = reduceUserDetails(req.body);

    db.doc(`/users/${req.user.handler}`).update(userDeatils)
        .then( () =>
        res.status(200).json({message: 'Added successfully'}))
        .catch( err =>
        res.status(500).json({error: err.code}));

};