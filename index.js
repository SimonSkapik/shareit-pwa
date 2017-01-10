var path = require('path'),
    express = require('express'),
    exphbs = require('express-handlebars'),
    logger = require('morgan'),
    cookieParser = require('cookie-parser'),
    bodyParser = require('body-parser'),
    methodOverride = require('method-override'),
    session = require('express-session'),
    passport = require('passport'),
    LocalStrategy = require('passport-local'),
    TwitterStrategy = require('passport-twitter'),
    GoogleStrategy = require('passport-google'),
    FacebookStrategy = require('passport-facebook'),
    formidable = require('formidable'),
    fs = require('fs'),
    config = require('./config.js'), //config file contains all tokens and other private info
    funct = require('./functions.js'); //funct file contains our helper functions for our Passport and database work
    http = require('http');
var app = express();
var server = http.createServer(app);
var io = require('socket.io').listen(server);

app.use(express.static('./public'));

//===============PASSPORT=================
// Passport session setup.
passport.serializeUser(function(user, done) {
  console.log("serializing " + user.username);
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  console.log("deserializing " + obj);
  done(null, obj);
});
// Use the LocalStrategy within Passport to login/"signin" users.
passport.use('local-signin', new LocalStrategy(
  {passReqToCallback : true}, //allows us to pass back the request to the callback
  function(req, username, password, done) {
    funct.localAuth(username, password)
    .then(function (user) {
      if (user) {
        console.log("LOGGED IN AS: " + user.username);
        req.session.success = 'You are successfully logged in ' + user.username + '!';
        done(null, user);
      }
      if (!user) {
        console.log("COULD NOT LOG IN");
        req.session.error = 'Could not log user in. Please try again.'; //inform user could not log them in
        done(null, user);
      }
    })
    .fail(function (err){
      console.log(err.body);
    });
  }
));
// Use the LocalStrategy within Passport to register/"signup" users.
passport.use('local-signup', new LocalStrategy(
  {passReqToCallback : true}, //allows us to pass back the request to the callback
  function(req, username, password, done) {
    funct.localReg(username, password)
    .then(function (user) {
      if (user) {
        console.log("REGISTERED: " + user.username);
        req.session.success = 'You are successfully registered and logged in ' + user.username + '!';
        done(null, user);
      }
      if (!user) {
        console.log("COULD NOT REGISTER");
        req.session.error = 'That username is already in use, please try a different one.'; //inform user could not log them in
        done(null, user);
      }
    })
    .fail(function (err){
      console.log(err.body);
    });
  }
));

//===============EXPRESS================
// Configure Express
app.use(logger('combined'));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(methodOverride('X-HTTP-Method-Override'));
app.use(session({secret: 'supernova', saveUninitialized: true, resave: true}));
app.use(passport.initialize());
app.use(passport.session());

// Session-persisted message middleware
app.use(function(req, res, next){
  var err = req.session.error,
      msg = req.session.notice,
      success = req.session.success;

  delete req.session.error;
  delete req.session.success;
  delete req.session.notice;

  if (err) res.locals.error = err;
  if (msg) res.locals.notice = msg;
  if (success) res.locals.success = success;

  next();
});


//===============SOCKET=================

io.on('connection', function(socket){
  socket.on('chat_message', function(msg){
	io.emit('chat_message', {sender: msg.sender, color: msg.color, message: msg.msg});
  });
  
  socket.on('project', function(data){
   io.emit('project-'+data.prj_url, {operation:data.operation, place:data.place, data:data.data});
  });
  
  
});

//===============LAYOUT=================

// Configure express to use handlebars templates
var hbs = exphbs.create({
    defaultLayout: 'main'  
});
app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');

//===============ROUTES=================

//displays homepage
app.get('/', function(req, res){
  res.render('home', {user: req.user});
});

//displays signup page
app.get('/signin', function(req, res){
  res.render('signin');
});

//displays account page
app.get('/account', function(req, res){
   if(req.user){
      res.render('account', {user: req.user});
   }else{
      req.session.error = 'Gotta sing in first buddy ;-)';
      res.redirect('/signin');
   }
  
});

//displays account page
app.get('/project/:prj_url', function(req, res){
   if(req.user){
      funct.get_project(req.params.prj_url)
       .then(function (project){
          if(project){
            funct.has_access_prj(req.user._id, req.params.prj_url)
             .then(function (access){
                if(access > 9){
                   res.render('project', {user: req.user, prj_url: req.params.prj_url, project_data : project, isAdmin : true});
                }else if(access > 0){
                   res.render('project', {user: req.user, prj_url: req.params.prj_url, project_data : project, isAdmin : false});
                }else{
                  req.session.error = 'Yeah... Affraid I can\'t let you in. ^v^';
                  res.redirect('/');
                }
             });
          }else{
            req.session.error = 'Sorry can\'t find this project :-/';
            res.redirect('/');
          }
       });
   }else{
      req.session.error = 'Gotta sing in first buddy ;-)';
      res.redirect('/signin');
   }
});

//sends the request through our local signup strategy, and if successful takes user to homepage, otherwise returns then to signin page
app.post('/local-reg', passport.authenticate('local-signup', {
  successRedirect: '/',
  failureRedirect: '/signin'
  })
);

//sends the request through our local login/signin strategy, and if successful takes user to homepage, otherwise returns then to signin page
app.post('/login', passport.authenticate('local-signin', {
  successRedirect: '/',
  failureRedirect: '/signin'
  })
);

app.post('/upload', function(req, res){
  // create an incoming form object
  var form = new formidable.IncomingForm();

  // specify that we want to allow the user to upload multiple files in a single request
  form.multiples = false;

  // store all uploads in the /uploads directory
  form.uploadDir = path.join(__dirname, '/public/uploads');

  // every time a file has been uploaded successfully,
  // rename it to it's orignal name
  var new_filename = "";
  form.on('file', function(field, file) {
    new_filename = file.name;
    fs.rename(file.path, path.join(form.uploadDir, file.name));
  });

  // log any errors that occur
  form.on('error', function(err) {
    console.log('An error has occured: \n' + err);
  });

  // once all the files have been uploaded, send a response to the client
  form.on('end', function() {
    res.end(new_filename);
  });

  // parse the incoming request containing the form data
  form.parse(req);

});

app.post('/update_acc', function(req, res){
    if(req.user){
      funct.update_acc(req.user, req.body.color);
      req.user.color = req.body.color;
      res.set("Content-type type/json");
      res.send({result:1});
   }
});

app.post('/add_project', function(req, res){
    if(req.user){
      funct.add_project(req.user, req.body.prj_name, req.body.prj_desc);
      res.set("Content-type type/json");
      res.send({result:1});
   }
});

app.post('/edit_project', function(req, res){
    if(req.user){
       funct.get_project(req.body.prj_url)
       .then(function (project){
          if(project){
            funct.has_access_prj(req.user._id, req.body.prj_url)
             .then(function (access){
                if(access > 9){
                   funct.edit_project(req.body.prj_url, req.body.prj_name, req.body.prj_desc)
                     .then(function(result){
                        res.set("Content-type type/json");
                        res.send({result:1});
                   });
                }
             });
          }
       });
   }
});

app.post('/delete_project', function(req, res){
    if(req.user){
       funct.get_project(req.body.prj_url)
       .then(function (project){
          if(project){
            funct.has_access_prj(req.user._id, req.body.prj_url)
             .then(function (access){
                if(access > 9){
                   funct.get_project_images(req.body.prj_url)
                   .then(function(imgs){
                      for(ind = 0; ind < imgs.length; ind++){
                         fs.unlink("/public/uploads/"+imgs[ind].img_name,function(){});
                      }
                      funct.delete_project(req.body.prj_url)
                        .then(function(result){
                           res.set("Content-type type/json");
                           res.send({result:1});
                           res.redirect('/');
                      });
                   });
                }
             });
          }
       });
   }
});

app.post('/share_project', function(req, res){
   if(req.user){
      funct.has_access_prj(req.user._id, req.body.prj)
       .then(function (access){
          if(access > 9){
             funct.share_project(req.body.prj, req.body.username);
          }
       });
   }
});


app.post('/get_my_projects', function(req, res){
    if(req.user){
      funct.get_my_projects(req.user._id)
       .then(function(projects){
          res.set("Content-type type/json");
          res.send(projects);
       });
   }
});

app.post('/get_shared_projects', function(req, res){
    if(req.user){
      funct.get_shared_projects(req.user._id)
       .then(function(projects){
          res.set("Content-type type/json");
          res.send(projects);
       });
   }
});

app.post('/send_project_message', function(req, res){
    if(req.user){
      funct.has_access_prj(req.user._id, req.body.prj_url)
       .then(function (access){
          if(access > 0){
             funct.send_project_message(req.body.prj_url, req.body.message, req.user)
              .then(function(result){
                 res.set("Content-type type/json");
                 res.send({});
              });
          }
       });
   }
});

app.post('/get_project_conversation', function(req, res){
   if(req.user){
      funct.has_access_prj(req.user._id, req.body.prj_url)
       .then(function (access){
         if(access > 0){
            funct.get_project_conversation(req.body.prj_url)
             .then(function(messages){
                for(ind = 0; ind < messages.length; ind++){
                   if(messages[ind].sender == req.user.username || req.user.role == "admin"){
                      messages[ind].access = true;
                   }else{
                      messages[ind].access = false;
                   }
                }
               res.set("Content-type type/json");
               res.send(messages);
             });
         }
       });
   }
});

app.post('/add_note', function(req, res){
    if(req.user){
      funct.has_access_prj(req.user._id, req.body.prj_url)
       .then(function (access){
          if(access > 0){
             funct.add_note(req.body.prj_url, req.body.title, req.body.body, req.user)
              .then(function(result){
                 res.set("Content-type type/json");
                 res.send({});
              });
          }
       });
   }
});

app.post('/edit_note', function(req, res){
    if(req.user){
      funct.has_note_access_prj(req.user, req.body.prj_url, req.body.number)
       .then(function (access){
          if(access){
             funct.edit_note(req.body.prj_url, req.body.number, req.body.title, req.body.body)
              .then(function(result){
                 res.set("Content-type type/json");
                 res.send({});
              });
          }
       });
   }
});

app.post('/get_project_notes', function(req, res){
   if(req.user){
      funct.has_access_prj(req.user._id, req.body.prj_url)
       .then(function (access){
         if(access > 0){
            funct.get_project_notes(req.body.prj_url)
             .then(function(notes){
                for(ind = 0; ind < notes.length; ind++){
                   if(notes[ind].sender == req.user.username || req.user.role == "admin"){
                      notes[ind].access = true;
                   }else{
                      notes[ind].access = false;
                   }
                }
               res.set("Content-type type/json");
               res.send(notes);
             });
         }
       });
   }
});

app.post('/send_note_comment', function(req, res){
    if(req.user){
      funct.has_access_prj(req.user._id, req.body.prj_url)
       .then(function (access){
          if(access > 0){
             funct.send_note_comment(req.body.prj_url, req.body.message, req.body.note_number, req.user)
              .then(function(result){
                 res.set("Content-type type/json");
                 res.send({});
              });
          }
       });
   }
});


app.post('/add_image', function(req, res){
    if(req.user){
      funct.has_access_prj(req.user._id, req.body.prj_url)
       .then(function (access){
          if(access > 0){
             funct.add_image(req.body.prj_url, req.body.img, req.body.title, req.body.desc)
              .then(function(result){
                 res.set("Content-type type/json");
                 res.send({});
              });
          }
       });
   }
});

app.post('/get_project_images', function(req, res){
   if(req.user){
      funct.has_access_prj(req.user._id, req.body.prj_url)
       .then(function (access){
         if(access > 0){
            funct.get_project_images(req.body.prj_url)
             .then(function(imgs){
                for(ind = 0; ind < imgs.length; ind++){
                   if(imgs[ind].sender == req.user.username || req.user.role == "admin"){
                      imgs[ind].access = true;
                   }else{
                      imgs[ind].access = false;
                   }
                }
               res.set("Content-type type/json");
               res.send(imgs);
             });
         }
       });
   }
});

app.post('/delete_image', function(req, res){
    if(req.user){
      funct.has_access_prj(req.user._id, req.body.prj_url)
       .then(function (access){
          if(access > 9){
             fs.unlink("/public/uploads/"+req.body.img,function(){});
             funct.delete_image(req.body.prj_url, req.body.img)
              .then(function(result){
                 res.set("Content-type type/json");
                 res.send({});
              });
          }
       });
   }
});

app.post('/get_note_conversation', function(req, res){
   if(req.user){
      funct.has_access_prj(req.user._id, req.body.prj_url)
       .then(function (access){
         if(access > 0){
            funct.get_note_conversation(req.body.prj_url, req.body.note_num)
             .then(function(messages){
               res.set("Content-type type/json");
               res.send(messages);
             });
         }
       });
   }
});
//logs user out of site, deleting them from the session, and returns to homepage
app.get('/logout', function(req, res){
  var name = req.user.username;
  console.log("LOGGIN OUT " + req.user.username)
  req.logout();
  res.redirect('/');
  req.session.notice = "You have successfully been logged out " + name + "!";
});

app.get('*', function(req, res){
  res.sendFile(__dirname + '/views/error/404.html');
});


//===============PORT=================
var port = process.env.PORT || 1338; //select your port or let it pull from your .env file
server.listen(port);
console.log("listening on " + port + "!");
