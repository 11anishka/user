var express         = require('express'),
    app             = express(),
    bodyParser      = require('body-parser'),
    nodemailer      = require('nodemailer'),
    multer          = require('multer'),
    path            = require('path'),
    GridFsStorage   = require('multer-gridfs-storage'),
    Grid            = require('gridfs-stream'),
    mongoose        = require('mongoose'),
    crypto          = require('crypto'),
    methodOverride  = require('method-override'),
    Faculty         = require('./models/Faculty'),
    Service         = require('./models/Service'),
    Journey         = require('./models/Journey'),
    User            = require('./models/User');            


var attachmentFileName

app.use(bodyParser.json())          // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
    extended: true
}))
app.use(methodOverride('_method'))

// Set Storage Engine
let storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: (req, file, callBack) => {
        attachmentFileName = file.fieldname + '-' + Date.now() + path.extname(file.originalname)
        callBack(null, attachmentFileName)
    }
})

let upload = multer({
    storage: storage,
    limits: { fileSize: 25000000 }
}).single('attachment')

const mongoURI = 'mongodb://localhost:27017/iotlabdb'
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false })
const conn = mongoose.connection

// Init gfs
let gfs

conn.once('open', () => {
    // Init stream
    console.log("Connected to mongodb")
    gfs = Grid(conn.db, mongoose.mongo)
    gfs.collection('images')
})

// Create storage engine
const DBstorage = new GridFsStorage({
    url: mongoURI,
    file: (req, file) => {
        return new Promise((resolve, reject) => {
            crypto.randomBytes(16, (err, buf) => {
                if (err) {
                    return reject(err)
                }
                const filename = buf.toString('hex') + path.extname(file.originalname)
                const fileInfo = {
                    filename: filename,
                    bucketName: 'images'
                }
                resolve(fileInfo)
            })
        })
    }
})
var DBupload = multer({ storage: DBstorage })

app.use(express.static('public'))
app.set('view engine', 'ejs')

app.get('/', (req, res) => {
    res.redirect('/index')
})

app.get('/index', (req, res) => {
    res.render('index.ejs')
})

app.get('/about', (req, res) => {
    res.render('about-us.ejs')
})

app.get('/contact', (req, res) => {
    res.render('contact-us.ejs')
})

app.get('/image/:filename', (req, res) => {
    gfs.files.findOne({ filename: req.params.filename }, (err, image) => {
        // Check if image
        if (!image || image.length === 0) {
            return res.status(404).json({
                err: 'No image exists'
            });
        }
        // Check if image
        if (image.contentType === 'image/jpeg' || image.contentType === 'image/png') {
            // Read output to browser
            const readstream = gfs.createReadStream(image.filename);
            readstream.pipe(res);
        } else {
            res.status(404).json({
                err: 'Not an image'
            });
        }
    });
});

app.get('/aboutus', (req, res) => {
    Faculty.find({}, (err, faculties) => {
        if (err) {
            res.send(err)
            console.log(err)
        } else {
            gfs.files.find().toArray((err, images) => {
                if (err) {
                    res.send(err)
                    console.log(err)
                } else {
                    images.map(image => image.isImage = true);
                    res.render('aboutus.ejs', { images: images, faculties: faculties });
                }
            });
        }
    })
})

app.post('/contact', (req, res) => {

    upload(req, res, (err) => {

        if (err) {
            console.log('Error Uploading the File!')
            console.log(err)
            res.render('contact-us', { msg: err })
        } else {
            console.log(attachmentFileName)
            console.log(req.file)
        }

        var email = req.body.email
        var name = req.body.name
        var reference = req.body.reference
        var subject = req.body.subject
        var message = req.body.message
        var newsletter = req.body.newsletter

        var transporter = nodemailer.createTransport({
            service: 'gmail',
            host: 'smtp.gmail.com',
            auth: {
                user: 'iotlabkiit@gmail.com',
                pass: 'IoT@kiit'
            }
        })

        var mailOptions = {
            from: name + " " + '<' + email + '>',
            to: 'iotlabkiit@gmail.com',
            subject: subject,
            text: 'Email: ' + email + '\n' + 'From: ' + name + '\n' + 'Reference: ' + reference + '\n\n' + message,
            replyTo: email,
            date: new Date(),
            attachments: [
                {
                    filename: attachmentFileName,
                    path: './public/uploads/' + attachmentFileName
                }
            ]
        }

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                return console.log(error.message)
            } else {
                console.log('Mail successfully sent!')
                res.send("Mail successfully sent!")
            }
        })
    })
})

const coll = 'journey';

app.get('/journey', (req, res) => {
    conn.collection(coll).find({}).toArray((err,journey)=>{
        if(err) {
            res.send(err);
            console.log(err);
        }
        else{
            gfs.files.find().toArray((err, images) => {
                if (err) {
                    res.send(err)
                    console.log(err)
                } else {
                    images.map(image => image.isImage = true);
                    res.render('our-journey.ejs',{ images: images,journey : journey});
                    console.log(journey);
                    console.log(images);
                }
            });
        }
             
    });  
})

app.get('/projects', (req, res) => {
    res.render('projects.ejs')
})

app.get('/services', (req, res) => {
    res.render('services.ejs')
})

app.get('/login', (req, res) => {
    res.render('members-login.ejs')
})

app.get('/admin', (req, res) => {
    res.render('adminpanel.ejs')
})

app.use('/journey',require('./routes/admin/journey'));
/* app.use('/admin/faculty', require('./routes/admin/faculties'))
app.use('/admin/services', require('./routes/admin/services.js'))
app.use('/admin/student', require('./routes/admin/students.js')) */
app.use('/admin/users',require('./routes/admin/users.js'));

app.post('/login', (req, res) => {
    console.log(req.body.email)
    console.log(req.body.password)

    res.send("OK")
})

app.get('/Memberslogin', (req, res) => {
    res.render('Memberslogin/Memberslogin.ejs')
})

app.post('/Memberslogin', (req, res) => {
    let email = req.body.email
    let password = req.body.password
    console.log(email)
    console.log(password)
})

///////////////////////////////////////////////////////////////////////////////////////////////////////////////
//Admin Panel
///////////////////////////////////////////////////////////////////////////////////////////////////////////////

//Faculty CRUD

app.get('/admin/faculty', (req, res) => {
    res.render('faculty-admin.ejs')
})

app.post('/admin/faculty/add', DBupload.single('file'), (req, res) => {
    Faculty.create({
        image: req.file.filename,
        name: req.body.name,
        designation: req.body.designation,
        schoolName: req.body.schoolName,
        email: req.body.email,
        index: req.body.index
    }, (err, faculty) => {
        if (err) console.error(err)
        else res.redirect('/aboutus')
    })
})

app.post('/admin/faculty/delete', (req, res) => {
    Faculty.findOneAndDelete({email: req.body.email}, (err, faculty) => {
        gfs.remove({ filename: faculty.image, root: 'images' }, (err, gridStore) => {
            if (err) {
                return res.status(404).json({ err: err })
            }
            res.redirect('/aboutus')
        })
    })
})

app.post('/admin/faculty/update', (req, res) => {
    Faculty.findOne({email: req.body.email}, (err, faculty) => {
        if(err){
            console.log(err)
            res.send(err)
        } else {
            res.render('update-faculty-details', {faculty: faculty})
        }
    })
})

app.post('/admin/faculty/update/:id', (req, res) => {
    Faculty.findOneAndUpdate({_id: req.params.id}, req.body, (err, faculty) => {
        if(err) {
            console.log(err)
            res.send(err)   
        } else {
            res.redirect('/aboutus')
        }
    })
})

//Services CRUD
app.get('/admin/services', (req, res) => {
    res.render('services-admin.ejs')
})

app.post('/admin/services/add', DBupload.single('file'), (req, res) => {
    Service.create({
        image: req.file.filename,
        title: req.body.title,
        description: req.body.description,
        index: req.body.index
    }, (err, service) => {
        if (err) console.error(err)
        else res.redirect('/services')
    })
})

app.post('/admin/services/delete', (req, res) => {
    Service.findOneAndDelete({title: req.body.title}, (err, service) => {
        gfs.remove({ filename: service.image, root: 'images' }, (err, gridStore) => {
            if (err) {
                return res.status(404).json({ err: err });
            }
            res.redirect('/services')
        })
    })
})

app.post('/admin/services/update', (req, res) => {
    Service.findOne({title: req.body.title}, (err, service) => {
        if(err){
            console.log(err)
            res.send(err)
        } else {
            res.render('update-service-details', {service: service})
        }
    })
})

app.post('/admin/services/update/:id', (req, res) => {
    Service.findOneAndUpdate({_id: req.params.id}, req.body, (err, service) => {
        if(err) {
            console.log(err)
            res.send(err)
        } else {
            res.redirect('/services')
        }
    })
})

//USER CRUD



app.post('/admin/users/delete', (req, res) => {
    User.findOneAndDelete({title: req.body.title}, (err, user) => {
        gfs.remove({ filename: user.image, root: 'images' }, (err, gridStore) => {
            if (err) {
                return res.status(404).json({ err: err });
            }
            res.redirect('/users')
        })
    })
})

app.post('/admin/users/update', (req, res) => {
    User.findOne({title: req.body.title}, (err, user) => {
        if(err){
            console.log(err)
            res.send(err)
        } else {
            res.render('update-user-details', {user: user})
        }
    })
})

app.post('/admin/users/update/:id', (req, res) => {
    User.findOneAndUpdate({_id: req.params.id}, req.body, (err, user) => {
        if(err) {
            console.log(err)
            res.send(err)
        } else {
            res.redirect('/users')
        }
    })
})



var port = 3000
app.listen(port, () => {
    console.log(`Server live at port: ${port}`)
})