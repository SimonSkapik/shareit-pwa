var bcrypt = require('bcryptjs'),
    Q = require('q'),
    config = require('./config.js'); //config file contains all tokens and other private info

// MongoDB connection information
var mongodbUrl = 'mongodb://user_simon:123456abc@ds159188.mlab.com:59188/heroku_s0gd2j6w';
var MongoClient = require('mongodb').MongoClient
var ObjectId = require('mongodb').ObjectID;

//used in local-signup strategy
exports.localReg = function (username, password) {
  var deferred = Q.defer();

  MongoClient.connect(mongodbUrl, function (err, db) {
    var collection = db.collection('localUsers');

    //check if username is already assigned in our database
    collection.findOne({'username' : username})
      .then(function (result) {
        if (null != result) {
          console.log("USERNAME ALREADY EXISTS:", result.username);
          deferred.resolve(false); // username exists
        }
        else  {
          var hash = bcrypt.hashSync(password, 8);
          var user = {
            "username": username,
            "password": hash,
            "avatar": "",
            "color": (Math.random()*0xFFFFFF<<0).toString(16)
          }

          console.log("CREATING USER:", username);

          collection.insert(user)
            .then(function () {
              db.close();
              deferred.resolve(user);
            });
        }
      });
  });

  return deferred.promise;
};


//check if user exists
    //if user exists check if passwords match (use bcrypt.compareSync(password, hash); // true where 'hash' is password in DB)
      //if password matches take into website
  //if user doesn't exist or password doesn't match tell them it failed
exports.localAuth = function (username, password) {
  var deferred = Q.defer();

  MongoClient.connect(mongodbUrl, function (err, db) {
    var collection = db.collection('localUsers');

    collection.findOne({'username' : username})
      .then(function (result) {
        if (null == result) {
          console.log("USERNAME NOT FOUND:", username);

          deferred.resolve(false);
        }
        else {
          var hash = result.password;

          console.log("FOUND USER: " + result.username);

          if (bcrypt.compareSync(password, hash)) {
            deferred.resolve(result);
          } else {
            console.log("AUTHENTICATION FAILED");
            deferred.resolve(false);
          }
        }

        db.close();
      });
  });

  return deferred.promise;
}

exports.update_acc = function (user, clr) {
  var deferred = Q.defer();
   
  MongoClient.connect(mongodbUrl, function (err, db) {
    var collection = db.collection('localUsers');
    collection.updateOne({ username : user.username }
      , { $set: { color : clr } }
    ); 
  });

  return deferred.promise;
};

exports.add_project = function (user, prj_name, prj_desc) {
  var deferred = Q.defer();
   
  MongoClient.connect(mongodbUrl, function (err, db) {
    var collection = db.collection('projects');
    var url = prj_name.toLowerCase().replace(/[^(a-z0-9-)]+/g," ").replace(/\s\s+/g, ' ').replace(/[ ]/g, '-');
    collection.insertOne({name:prj_name, description: prj_desc, author : ObjectId(user._id), url_name: url}); 
  });

  return deferred.promise;
};

exports.edit_project = function (prj_url, prj_name, prj_desc) {
  var deferred = Q.defer();
   
  MongoClient.connect(mongodbUrl, function (err, db) {
    var collection = db.collection('projects');
    collection.updateOne({url_name: prj_url},{$set : {name:prj_name, description: prj_desc}},function(){
       deferred.resolve(true);
    }); 
  });

  return deferred.promise;
};

exports.delete_project = function (prj_url, prj_name, prj_desc) {
  var deferred = Q.defer();
   
  MongoClient.connect(mongodbUrl, function (err, db) {
    var collection = db.collection('messages');
    collection.deleteMany({project: prj_url});
    
    collection = db.collection('images');
    collection.deleteMany({project: prj_url});
     
    collection = db.collection('notes');
    collection.deleteMany({project: prj_url});
    
    collection = db.collection('projects_sharing');
    collection.deleteMany({project: prj_url});
    
    collection = db.collection('projects');
    collection.deleteOne({url_name: prj_url},function(err, del){
       deferred.resolve(true);
    }); 
  });

  return deferred.promise;
};

exports.share_project = function (prj_url, name) {
  //var deferred = Q.defer();
   
  MongoClient.connect(mongodbUrl, function (err, db) {
    var collection = db.collection('localUsers');
    collection.findOne({username : name}, function(err, user){
       if(user){
          var collection2 = db.collection('projects_sharing');
          collection2.insertOne({person : user._id, project : prj_url});
       }
    });
  });

  //return deferred.promise;
};

exports.has_access_prj = function (user_id, prj_url) {
   var deferred = Q.defer();
   var allow = 0;
   
  MongoClient.connect(mongodbUrl, function (err, db) {
     var collection = db.collection('localUsers');
     
     collection.findOne(ObjectId(user_id),function(err, user){
        if(user.role == "admin"){
           deferred.resolve(100);
        }else{
           var collection2 = db.collection('projects');
           collection2.findOne({author : ObjectId(user_id), url_name : prj_url},function(err, author){
              if(author){
                 deferred.resolve(10);
              }else{
                  var collection3 = db.collection('projects_sharing');
                  collection3.findOne({person : ObjectId(user_id), project : prj_url},function(err, member){
                     if(member){
                        deferred.resolve(1);
                     }else{
                        deferred.resolve(false);
                     }
                  });
              }
           });
        }
     });
     
  });
  
  
  return deferred.promise;
};

exports.has_note_access_prj = function (user, prj_url, note_num) {
   var deferred = Q.defer();
   var allow = 0;
   
  MongoClient.connect(mongodbUrl, function (err, db) {
     var collection = db.collection('notes');
     
     collection.findOne({sender : user.username, project : prj_url, number : note_num},function(err, note){
        if(note || user.role == "admin"){
           deferred.resolve(true);
        }else{
           deferred.resolve(false);
        }
     });
     
  });
  
  return deferred.promise;
};

exports.get_project = function (prj_url) {
   var deferred = Q.defer();
   
  MongoClient.connect(mongodbUrl, function (err, db) {
     var collection = db.collection('projects');
     collection.findOne({url_name:prj_url,}, function(err, project){
        deferred.resolve(project);
     });
  });
  
  return deferred.promise;
   
};

exports.get_my_projects = function (user_id) {
  var deferred = Q.defer();

  MongoClient.connect(mongodbUrl, function (err, db) {
     var collection = db.collection('projects');
     
     collection.find({author : ObjectId(user_id)}).toArray(function(err, projects){
        deferred.resolve(projects);
     });     
  });
  
  return deferred.promise;
};

exports.get_shared_projects = function (user_id) {
  var deferred = Q.defer();

  MongoClient.connect(mongodbUrl, function (err, db) {
     var collection = db.collection('projects_sharing');
     collection.find({person : ObjectId(user_id)}).toArray(function(err, shared){
        var collection2 = db.collection('projects');
        var arr = new Array();
        for(ind = 0; ind < shared.length; ind++){
           arr.push(shared[ind].project);
        }
        collection2.find({url_name : {$in : arr}}).toArray(function(err, projects){
           deferred.resolve(projects);
        });  
        
     });
     
        
  });
  
  return deferred.promise;
};

exports.send_project_message = function (prj, msg, user) {
  var deferred = Q.defer();

  MongoClient.connect(mongodbUrl, function (err, db) {
     var collection = db.collection('messages');
     collection.insertOne({sender : user.username, color : user.color, timestamp : Date.now(), project : prj, note_number : 0, message : msg}, function(err, shared){
        deferred.resolve(true);
     });
  });
  
  return deferred.promise;
};

exports.get_project_conversation = function (prj) {
  var deferred = Q.defer();

  MongoClient.connect(mongodbUrl, function (err, db) {
     var collection = db.collection('messages');
     collection.find({project : prj, note_number : 0}).toArray(function(err, messages){
        deferred.resolve(messages);
     });
  });
  
  return deferred.promise;
};

exports.add_note = function (prj, ttl, msg, user) {
  var deferred = Q.defer();

  MongoClient.connect(mongodbUrl, function (err, db) {
     var collection = db.collection('notes');
     collection.find({project : prj}).toArray(function(err, notes){
        var num = notes.length + 1;
        collection.insertOne({number : num, sender : user.username, timestamp : Date.now(), project : prj, title : ttl, body : msg}, function(err, shared){
           deferred.resolve(true);
        });
     });     
  });
  
  return deferred.promise;
};

exports.edit_note = function (prj, num, ttl, msg) {
  var deferred = Q.defer();

  MongoClient.connect(mongodbUrl, function (err, db) {
     var collection = db.collection('notes');
     //console.log(prj + "--" + num + "--" + ttl + "--" + msg);
     collection.updateOne({project : prj, number : parseInt(num)},{$set : {title : ttl, body : msg}}, function(err, note){
        deferred.resolve(true);
     });
  });
  
  return deferred.promise;
};

exports.get_project_notes = function (prj) {
  var deferred = Q.defer();

  MongoClient.connect(mongodbUrl, function (err, db) {
     var collection = db.collection('notes');
     collection.find({project : prj}).toArray(function(err, notes){
        deferred.resolve(notes);
     });
  });
  
  return deferred.promise;
};

exports.send_note_comment = function (prj, msg, num, user) {
  var deferred = Q.defer();

  MongoClient.connect(mongodbUrl, function (err, db) {
     var collection = db.collection('messages');
     collection.insertOne({sender : user.username, color : user.color, timestamp : Date.now(), project : prj, note_number : parseInt(num), message : msg}, function(err, shared){
        deferred.resolve(true);
     });
  });
  
  return deferred.promise;
};

exports.get_note_conversation = function (prj, num) {
  var deferred = Q.defer();

  MongoClient.connect(mongodbUrl, function (err, db) {
     var collection = db.collection('messages');
     collection.find({project : prj, note_number : parseInt(num)}).toArray(function(err, messages){
        deferred.resolve(messages);
     });
  });
  
  return deferred.promise;
};


exports.add_image = function (prj, img, ttl, desc) {
  var deferred = Q.defer();

  MongoClient.connect(mongodbUrl, function (err, db) {
     var collection = db.collection('images');
     collection.insertOne({img_name : img, project : prj, title : ttl, description : desc}, function(err, img){
        deferred.resolve(true);
     });
  });
  
  return deferred.promise;
};

exports.get_project_images = function (prj) {
  var deferred = Q.defer();

  MongoClient.connect(mongodbUrl, function (err, db) {
     var collection = db.collection('images');
     collection.find({project : prj}).toArray(function(err, notes){
        deferred.resolve(notes);
     });
  });
  
  return deferred.promise;
};

exports.delete_image = function (prj, img) {
  var deferred = Q.defer();

  MongoClient.connect(mongodbUrl, function (err, db) {
     var collection = db.collection('images');
     collection.deleteOne({img_name : img, project : prj}, function(err, img){
        deferred.resolve(true);
     });
  });
  
  return deferred.promise;
};










