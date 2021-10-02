var express = require("express");
var app = express();

var formidable = require("express-formidable")
app.use(formidable());

var mongodb = require("mongodb");
var mongoClient = mongodb.MongoClient;
var ObjectId = mongodb.ObjectID;

var http = require("http").createServer(app);
var bcrypt = require("bcrypt");
var filesystem = require("fs");

var jwt = require("jsonwebtoken");
const e = require("express");
//const { Http2ServerResponse } = require("http2");
var accessTokenSecret = "myAccessTokenSecret1234567890";

app.use("/public", express.static(__dirname + "/public"));
app.set("view engine", "ejs");

var socketIO = require("socket.io")(http);
var socketID = "";
var users = [];

var total_posts = 0;

var mainURL = "http://localhost:3000";

socketIO.on("connection", function (socket) {
    console.log("User connected", socket.id);
    socketID = socket.id;
});

http.listen(3000, function() {
    console.log("Server started.");
    
    mongoClient.connect("mongodb://localhost:27017", { useUnifiedTopology: true }, function(error, client) {
        var database = client.db("my_social_network");
        console.log("Database connected.");
        
        app.get("/signup", function (request, result) {
            //result.get("signup");
            result.render('signup')
        });

        app.post("/signup", function (request, result) {
            var name = request.fields.name;
            var username = request.fields.username;
            var email = request.fields.email;
            var password = request.fields.password;
            var gender = request.fields.gender;

            database.collection("users").findOne({
                $or: [{
                    "email": email
                }, {
                    "username": username
                }]
            }, function (error, user) {
                if (user == null) {
                    bcrypt.hash(password, 10, function (error, hash) {
                        database.collection("users").insertOne({
                            "name": name,
                            "username": username,
                            "email": email,
                            "password": hash,
                            "gender": gender,
                            "profileImage": "",
                            "coverPhoto": "",
                            "dob": "",
                            "city": "",
                            "country": "",
                            "aboutMe": "",
                            "blue_points": 100,
                            "friends": [],
                            "pages": [],
                            "notifications": [],
                            "groups": [],
                            "posts": []
                        }, function (error, data) {
                            result.json({
                                "status": "success",
                                "message": "Signed up successfully. You can login now."
                            });
                        });
                    });
                } else {
                    result.json({
                        "status": "error",
                        "message": "email or username already exist."
                    });
                }
            });
            
        });

        app.get("/login", function (request, result) {
            result.render("login");
        });

        app.post("/login", function(request, result) {
            var email = request.fields.email;
            var password = request.fields.password;

            database.collection("users").findOne({
                "email": email
            }, function (error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "Email does not exist"
                    });
                } else {
                    bcrypt.compare(password, user.password, function (error, isVerify) {
                        if (isVerify) {
                            var accessToken = jwt.sign({ email: email }, accessTokenSecret);
                            database.collection("users").findOneAndUpdate({
                                "email": email
                            }, {
                                $set: {
                                    "accessToken": accessToken
                                }
                            }, function (error, data) {
                                result.json({
                                    "status": "success",
                                    "message": "Login succesfully",
                                    "accessToken": accessToken,
                                    "profileImage": user.profileImage
                                });
                            });
                        } else {
                            result.json({
                                "status": "error",
                                "message": "Password is not correct"
                            });
                        }
                    });
                }
            });
        });

        app.get("/updateProfile", function (request, result) {
            result.render("updateProfile");
        });

        app.get("/user/*", function (request, result) {
            result.render("userProfile");
        });

        app.post("/getUser", function (request, result) {
            
            var accessToken = request.fields.accessToken;
            database.collection("users").findOne({
                "accessToken": accessToken
            }, function (error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "User has been logged out. Please login again."
                    });
                } else {
                    result.json({
                        "status": "success",
                        "message": "Record has been fetched",
                        "data": user
                    });
                }
            });
        });

        app.post("/getPageUser", function (request, result) {
            var userID = request.fields.userID;

            database.collection("users").findOne({
                "_id": ObjectId(userID)
            }, function (error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "User does not exist."
                    });
                } else {
                    result.json({
                        "status": "success",
                        "message": "User has been fetched",
                        "data": user
                    });
                }
            });
        });

        app.get("/logout", function (request, result) {
            result.redirect("/login");
        });

        app.post("/uploadCoverPhoto", function (request, result) {
            var accessToken = request.fields.accessToken;
            var coverPhoto = "";

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function (error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "User has been logged out. Please login again."
                    });
                } else {
                    if (request.files.coverPhoto.size > 0 && request.files.coverPhoto.type.includes("image")) {
                        if (user.coverPhoto != "") {
                            filesystem.unlink(user.coverPhoto, function (error) {
                                //
                            });
                        }

                        coverPhoto = "public/images/" + new Date().getTime() + "-" + request.files.coverPhoto.name;
                        filesystem.rename(request.files.coverPhoto.path, coverPhoto, function (error) {
                            //
                        });

                        database.collection("users").updateOne({
                            "accessToken": accessToken
                        }, {
                            $set: {
                                "coverPhoto": coverPhoto
                            }
                        }, function (error, data) {
                            result.json({
                                "status": "status", 
                                "message": "Cover photo has been updated.",
                                data: mainURL + "/" + coverPhoto
                            });
                        });
                    } else {
                        result.json({
                            "status": "error",
                            "message": "Please select valid image."
                        });
                    }
                }
            });
        });

        app.post("/uploadProfileImage", function (request, result) {
            var accessToken = request.fields.accessToken;
            var profileImage = "";

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function (error, user) {
                if (user == null) {
                    request.json({
                        "status": "error",
                        "message": "User has been logged out. Please login again."
                    });
                } else {
                    if (request.files.profileImage.size > 0 && request.files.profileImage.type.includes("image")) {
                        if (user.profileImage != "") {
                            filesystem.unlink(user.profileImage, function (error) {
                                //
                            });
                        }

                        profileImage = "public/images/" + new Date().getTime() + "-" + request.files.profileImage.name;
                        filesystem.rename(request.files.profileImage.path, profileImage, function (error) {
                            //
                        });

                        database.collection("users").updateOne({
                            "accessToken": accessToken
                        }, {
                            $set: {
                                "profileImage": profileImage
                            }
                        }, function (error, data) {
                            result.json({
                                "status": "status",
                                "message": "Profile image has been updated.",
                                data: mainURL + "/" + profileImage
                            });
                        });
                    } else {
                        result.json({
                            "status": "error",
                            "message": "Please select valid image."
                        });
                    }
                }
            });
        });

        app.post("/updateProfile", function (request, result) {
            var accessToken = request.fields.accessToken;
            var name = request.fields.name;
            var dob = request.fields.dob;
            var city = request.fields.city;
            var country = request.fields.country;
            var aboutMe = request.fields.aboutMe;

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function (error, user) {
                if (user == null) {
                    result.json({
                        "status": "status",
                        "message": "User has been logged out. Please login again."
                    });
                } else {
                    database.collection("users").updateOne({
                        "accessToken": accessToken
                    }, {
                        $set: {
                            "name": name,
                            "dob": dob,
                            "city": city,
                            "country": country,
                            "aboutMe": aboutMe
                        }
                    }, function (error, data) {
                        result.json({
                            "status": "status",
                            "message": "Profile has been updated."
                        });
                    });
                }
            });
        });

        app.get("/", function (request, result) {
            result.render("index");
        });

        app.post("/addPost", function (request, result) {
            var accessToken = request.fields.accessToken;
            var caption = request.fields.caption;
            var image = "";
            var video = "";
            var type = request.fields.type;
            var createdAt = new Date().getTime();
            var _id = request.fields._id;

            var post_type = request.fields.post_type;

            if (post_type == "dare") {

                //add check if dareID passed through is unique before entering it in database
                //if unique, fine. Otherwise create new unique ID again
                //...
                //

                var goal = request.fields.goal;
                var dareID = request.fields.passed_dareID;
                
                database.collection("users").findOne({
                    "accessToken": accessToken
                }, function (error, user) {
                    if (user == null) {
                        result.json({
                            "status": "error",
                            "message": "User has been logged out. Please login again."
                        });
                    } else {
                        if (request.files.image.size > 0 && request.files.image.type.includes("image")) {
                            image = "public/images/" + new Date().getTime() + "-" + request.files.image.name;
                            filesystem.rename(request.files.image.path, image, function(error) {
                                //
                            });
                        }
    
                        if (request.files.video.size > 0 && request.files.video.type.includes("video")) {
                            video = "public/videos/" + new Date().getTime() + "-" + request.files.video.name;
                            filesystem.rename(request.files.video.path, video, function(error) {
                                //
                            });
                        }
    
                        database.collection("posts").insertOne({
                            "caption": caption,
                            "image": image,
                            "video": video,
                            "type": "posta",
                            "distinction": post_type,
                            "createdAt": createdAt,
                            "likers": [],
                            "comments": [],
                            "shares": [],
                            "dares": [], //this will be list of users with their amount contributed (kinda like comments but with number)
                            "bp_now": 0,
                            "bp_goal": goal,
                            "dareID": dareID,
                            "dare_open": true,
                            "dare_status": "not completed", //can be "ready", "waiting", "accepted" or "failed"
                            "user": {
                                "_id": user._id,
                                "name": user.name,
                                "profileImage": user.profileImage,
                            }
                        }, function (error, data) {
                            database.collection("users").updateOne({
                                "accessToken": accessToken
                            }, {
                                $push: {
                                    "posts": {
                                        "_id": data.insertedId,
                                        "caption": caption,
                                        "image": image,
                                        "video": video,
                                        "type": "posta",
                                        "distinction": post_type,
                                        "createdAt": createdAt,
                                        "likers": [],
                                        "comments": [],
                                        "shares": [],
                                        "dares": [],
                                        "bp_now": 0,
                                        "bp_goal": goal,
                                        "dareID": dareID,
                                        "dare_open": true,
                                        "dare_status": "not completed"
                                    }
                                }
                            }, function (error, data) {
                                result.json({
                                    "status": "success",
                                    "message": "Dare has been uploaded."
                                });
                            });
                        });
                    }
                    
                });
            } else if (post_type == "completed") {
                var dareID = request.fields.dareID;
                var number_of_dares = 0;

                database.collection("users").findOne({
                    "accessToken": accessToken
                }, function (error, user) {
                    if (user == null) {
                        result.json({
                            "status": "error",
                            "message": "User has been logged out. Please login again."
                        });
                    } else {
                        database.collection("posts").findOne({
                            $and: [{
                                "dareID": dareID
                            }, {
                                "distinction": "dare"
                            }]
                        }, function(error, dare) {
                            if (dare == null) {
                                result.json({
                                    "status": "error",
                                    "message": "Dare (dareID) does not exist."
                                });
                            } else {
                                if (dare.dare_open == true) {
                                    result.json({
                                        "status": "error",
                                        "message": "Dare has not reached it's goal yet. Post submitted when goal is reached."
                                    });
                                } else if (dare.dare_status !== "ready") {
                                    result.json({
                                        "status": "error",
                                        "message": "Dare has already been completed or failed. Post a new dare!"
                                    });
                                } else {
                                    database.collection("posts").findOne({
                                        $and: [{
                                            "user._id": user._id
                                        }, {
                                            "dareID": dareID
                                        }, {
                                            "distinction": "dare"
                                        }]
                                    }, function(error, data) {
                                        if (data == null) {
                                            result.json({
                                                "status": "error",
                                                "message": "Dare was not posted by you."
                                            });
                                        } else {
                                            number_of_dares = data.dares.length;
                                            bp_goal = data.bp_goal;

                                            if (request.files.image.size > 0 && request.files.image.type.includes("image")) {
                                                image = "public/images/" + new Date().getTime() + "-" + request.files.image.name;
                                                filesystem.rename(request.files.image.path, image, function(error) {
                                                    //
                                                });
                                            }
                        
                                            if (request.files.video.size > 0 && request.files.video.type.includes("video")) {
                                                video = "public/videos/" + new Date().getTime() + "-" + request.files.video.name;
                                                filesystem.rename(request.files.video.path, video, function(error) {
                                                    //
                                                });
                                            }
    
                                            database.collection("posts").insertOne({
                                                "caption": caption,
                                                "image": image,
                                                "video": video,
                                                "type": "posta",
                                                "distinction": post_type,
                                                "createdAt": createdAt,
                                                "likers": [],
                                                "comments": [],
                                                "shares": [],
                                                "dares": data.dares,
                                                "dare_users": number_of_dares, //count of users in dare list from dareID dare post
                                                "accepted": [],
                                                "rejected": [],
                                                "dareID": dareID,
                                                "bp_goal": bp_goal,
                                                "dare_accepted": false,
                                                "dare_rejected": false,
                                                "user": {
                                                    "_id": user._id,
                                                    "name": user.name,
                                                    "profileImage": user.profileImage,
                                                }
                                            }, function (error, data) {
                                                database.collection("users").updateOne({
                                                    "accessToken": accessToken
                                                }, {
                                                    $push: {
                                                        "posts": {
                                                            "_id": data.insertedId,
                                                            "caption": caption,
                                                            "image": image,
                                                            "video": video,
                                                            "type": "posta",
                                                            "distinction": post_type,
                                                            "createdAt": createdAt,
                                                            "likers": [],
                                                            "comments": [],
                                                            "shares": [],
                                                            "dares": data.dares,
                                                            "dare_users": number_of_dares, //this will be the count of users in dare list from dareID dare post (still to implement)
                                                            "accepted": [],
                                                            "rejected": [],
                                                            "dareID": dareID,
                                                            "bp_goal": bp_goal,
                                                            "dare_accepted": false,
                                                            "dare_rejected": false
                                                        }
                                                    }
                                                }, function (error, data) {
                                                    database.collection("posts").updateOne({
                                                        $and: [{
                                                            "user._id": user._id
                                                        }, {
                                                            "dareID": dareID
                                                        }, {
                                                            "distinction": "dare"
                                                        }]
                                                    }, {
                                                        $set: {
                                                            "dare_status": "waiting"
                                                        }
                                                    });

                                                    result.json({
                                                        "status": "success",
                                                        "message": "Completed dare has been uploaded."
                                                    });
                                                });
                                            });
    
                                        }
                                    });
                                }
                            }
                        });
                    }
                });

                //make dare_open of referenced dareID dare to false, to prevent 2 completed submission at same time
                //MAYBE NOT, DECIDE. reopen the dare if if is rejected (will be in separate server call, becuase here we do not check for accepted/rejected we just post)
                
            }
            
        });

        app.post("/getNewsfeed", function (request, result) {
            var accessToken = request.fields.accessToken;

            database.collection("posts").find({"type": "posta"}).toArray(function(error, data) {
                if (data == null) {
                    console.log("no posts in db");
                    result.json({
                        "status": "success",
                        "message": "No posts available.",
                        "no_posts": true
                    });
                } else {
                    total_posts = data.length;
                }
                
            });

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function (error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "User has been logged out. Please login again."
                    });
                } else {
                    if (total_posts >= 5) {
                        var ids = [];
                        ids.push(user._id);
                        database.collection("posts")
                        .find({
                            "type": "posta"
                        })
                        .sort({
                            "createdAt": -1
                        })
                        .limit(5)
                        .toArray(function (error, data) {
                            result.json({
                                "status": "success",
                                "message": "Record has been fetched",
                                "data": data
                            });
                        });
                    } else {
                        database.collection("posts")
                        .find({
                            "type": "posta"
                        })
                        .sort({
                            "createdAt": -1
                        })
                        .limit(total_posts)
                        .toArray(function (error, data) {
                            result.json({
                                "status": "success",
                                "message": "Record has been fetched",
                                "data": data
                            });
                        });
                    }
                    
                }
                
            });
        });

        app.post("/getMorePosts", function (request, result) {
            var accessToken = request.fields.accessToken;
            var counter = parseInt(request.fields.posts_loaded);

            database.collection("posts").find({"type": "posta"}).toArray(function(error, data) {
                total_posts = data.length;
            });

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function (error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "User has been logged out. Please login again."
                    });
                } else {
                    if (total_posts > counter + 5) {
                        
                        database.collection("posts")
                        .find({
                            "type": "posta"
                        })
                        .sort({
                            "createdAt": -1
                        })
                        .limit(counter + 5)
                        .toArray(function (error, data) {
                            result.json({
                                "status": "success",
                                "message": "Record has been fetched",
                                "data": data
                            });
                        });
                    } else if ((total_posts - counter) == 0){
                        result.json({
                            "status": "success",
                            "message": "Nothing has been fetched",
                            "data": "empty"
                        });
                    } else {
                        
                        database.collection("posts")
                        .find({
                            "type": "posta"
                        })
                        .sort({
                            "createdAt": -1
                        })
                        .limit(counter + (total_posts - counter))
                        .toArray(function (error, data) {
                            result.json({
                                "status": "success",
                                "message": "Record has been fetched",
                                "data": data
                            });
                        });
                    }
                }
                
            });
        });
        
        app.post("/getMyPosts", function(request, result) {
            var userID = request.fields.userID;

            database.collection("users").findOne({
                "_id": ObjectId(userID)
            }, function (error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "User does not exist."
                    });
                } else {
                    database.collection("posts").find({
                        "user._id": user._id
                    }).sort({ _id: -1 }).toArray(function(error, data) {
                        result.json({
                            "status": "success",
                            "message": "My posts were fetched.",
                            "data": data
                        });
                    });
                }
            });
        });

        app.get("/dares", function(request, result) {
            result.render("dares");
        });
        
        app.post("/getDares", function(request, result) {
            var accessToken = request.fields.accessToken;

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function (error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "User has been logged out. Please login again."
                    });
                } else {
                    database.collection("posts").find({
                        "distinction": "dare"
                    }).sort({ _id: -1 }).toArray(function(error, posts) {
                        result.json({
                            "status": "success",
                            "message": "Dares were fetched.",
                            "data": posts
                        });
                    });
                }
            });
        });

        app.get("/completed", function(request, result) {
            result.render("completed");
        });
        
        app.post("/getCompleted", function(request, result) {
            var accessToken = request.fields.accessToken;

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function (error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "User has been logged out. Please login again."
                    });
                } else {
                    database.collection("posts").find({
                        "distinction": "completed"
                    }).sort({ _id: -1 }).toArray(function(error, posts) {
                        result.json({
                            "status": "success",
                            "message": "Completed were fetched.",
                            "data": posts
                        });
                    });
                }
            });
        });

        app.post("/getUserPosts", function(request, result) {
            var userID = request.fields.userID;

            database.collection("users").findOne({
                "_id": ObjectId(userID)
            }, function (error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "User does not exist."
                    });
                } else {
                    database.collection("posts").find({
                        "user._id": user._id
                    }).sort({ _id: -1 }).toArray(function(error, data) {
                        result.json({
                            "status": "success",
                            "message": "Page user posts were fetched.",
                            "data": data
                        });
                    });
                }
            });
        });

        app.post("/toggleLikePost", function(request, result) {
            var accessToken = request.fields.accessToken;
            var _id = request.fields._id;

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function (error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "User has been logged out. Please login again."
                    });
                } else {
                    database.collection("posts").findOne({
                        "_id": ObjectId(_id)
                    }, function (error, post) {
                        if (post == null) {
                            result.json({
                                "status": "error",
                                "message": "Post does not exist."
                            });
                        } else {
                            var isLiked = false;

                            for (var a = 0; a < post.likers.length; a++) {
                                var liker = post.likers[a];

                                if (liker._id.toString() == user._id.toString()) {
                                    isLiked = true;
                                    break;
                                }
                            }

                            if (isLiked) {
                                database.collection("posts").updateOne({
                                    "_id": ObjectId(_id)
                                }, {
                                    $pull: {
                                        "likers": {
                                            "_id": user._id,
                                        }
                                    }
                                }, function (error, data) {
                                    database.collection("users").updateOne({
                                        $and: [{
                                            "_id": post.user._id
                                        }, {
                                            "post._id": post._id
                                        }]
                                    }, {
                                        $pull: {
                                            "posts.$[].likers": {
                                                "_id": user._id,
                                            }
                                        }
                                    });

                                    result.json({
                                        "status": "unliked",
                                        "message": "Post has been unliked."
                                    });
                                });
                            } else {
                                database.collection("users").updateOne({
                                    "_id": post.user._id
                                }, {
                                    $push: {
                                        "notifications": {
                                            "_id": ObjectId(),
                                            "type": "photo_liked",
                                            "content": user.name + " has liked your post.",
                                            "profileImage": user.profileImage,
                                            "createdAt": new Date().getTime()
                                        }
                                    }
                                });

                                database.collection("posts").updateOne({
                                    "_id": ObjectId(_id)
                                }, {
                                    $push: {
                                        "likers": {
                                            "_id": user._id,
                                            "name": user.name,
                                            "profileImage": user.profileImage
                                        }
                                    }
                                }, function (error, data) {
                                    database.collection("users").updateOne({
                                        $and: [{
                                            "_id": post.user._id
                                        }, {
                                            "posts._id": post._id
                                        }]
                                    }, {
                                        $push: {
                                            "posts.$[].likers": {
                                                "_id": user._id,
                                                "name": user.name,
                                                "profileImage": user.profileImage
                                            }
                                        }
                                    });

                                    result.json({
                                        "status": "success",
                                        "message": "Post has been liked."
                                    });
                                });

                            }
                        }
                    });
                    
                }
            });
        });

        app.post("/postComment", function(request, result) {
            var accessToken = request.fields.accessToken;
            var _id = request.fields._id;
            var comment = request.fields.comment;
            var createdAt = new Date().getTime();

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function (error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "User has been logged out. Please login again."
                    });
                } else {
                    database.collection("posts").findOne({
                        "_id": ObjectId(_id)
                    }, function (error, post) {
                        if (post == null) {
                            result.json({
                                "status": "error",
                                "message": "Post does not exist."
                            });
                        } else {
                            var commentID = ObjectId();

                            database.collection("posts").updateOne({
                                "_id": ObjectId(_id)
                            }, {
                                $push: {
                                    "comments": {
                                        "_id": commentID,
                                        "user": {
                                            "_id": user._id,
                                            "name": user.name,
                                            "profileImage": user.profileImage,
                                        },
                                        "comment": comment,
                                        "createdAt": createdAt,
                                        "replies": []
                                    }
                                }
                            }, function (error, data) {
                                if (user._id.toString() != post.user._id.toString()) {
                                    database.collection("users").updateOne({
                                        "_id": post.user._id
                                    }, {
                                        $push: {
                                            "notifications": {
                                                "_id": ObjectId(),
                                                "type": "new_comment",
                                                "content": user.name + " commented on your post.",
                                                "profileImage": user.profileImage,
                                                "createdAt": new Date().getTime()
                                            }
                                        }
                                    });
                                }

                                database.collection("users").updateOne({
                                    $and: [{
                                        "_id": post.user._id
                                    }, {
                                        "posts._id": post._id
                                    }]
                                }, {
                                    $push: {
                                        "posts.$[].comments": {
                                            "_id": commentID,
                                            "user": {
                                                "_id": user._id,
                                                "name": user.name,
                                                "profileImage": user.profileImage,
                                            },
                                            "comment": comment,
                                            "createdAt": createdAt,
                                            "replies": []
                                        }
                                    }
                                }, function (error, data) {
                                    database.collection("posts").findOne({
                                        "_id": ObjectId(_id)
                                    }, function (error, thispost) {
                                        result.json({
                                            "status": "success",
                                            "message": "Comment has been posted",
                                            "comment": comment,
                                            "user": user,
                                            "createdAt": createdAt,
                                            "post_id": _id,
                                            "new_num": (post.comments.length + 1)
                                        });
                                    });
                                });

                            });
                        }
                    });
                }
            });
        });

        app.post("/sharePost", function (request, result) {
            var accessToken = request.fields.accessToken;
            var _id = request.fields._id;
            var type = "shared";
            var createdAt = new Date().getTime();

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function (error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "User has been logged out. Please loggin again."
                    });
                } else {
                    database.collection("posts").findOne({
                        "_id": ObjectId(_id)
                    }, function (error, post) {
                        if (post == null) {
                            result.json({
                                "status": "error",
                                "message": "Post does not exist."
                            });
                        } else {
                            database.collection("posts").updateOne({
                                "_id": ObjectId(_id)
                            }, {
                                $push: {
                                    "shares": {
                                        "_id": user._id,
                                        "name": user.name,
                                        "profileImage": user.profileImage
                                    }
                                }
                            }, function(error, data) {
                                database.collection("posts").insertOne({
                                    "caption": post.caption,
                                    "image": post.image,
                                    "video": post.video,
                                    "type": "posta",
                                    "createdAt": createdAt,
                                    "likers": [],
                                    "comments": [],
                                    "shares": [],
                                    "user": {
                                        "_id": user._id,
                                        "name": user.name,
                                        "profileImage": user.profileImage,
                                    }
                                }, function (error, data) {
                                    database.collection("users").updateOne({
                                        $and: [{
                                            "_id": post.user._id
                                        }, {
                                            "posts._id": post._id
                                        }]
                                    }, {
                                        $push: {
                                            "posts.$[].shares": {
                                                "_id": user._id,
                                                "name": user.name,
                                                "profileImage": user.profileImage
                                            }
                                        }
                                    }); 
                                    
                                    result.json({
                                        "status": "success",
                                        "message": "Post has been shared."
                                    });
                                });
                            });
                        }
                    });
                }
            });
        });

        app.get("/search/:query", function(request, result) {
            var query = request.params.query;
            result.render("search", {
                "query": query
            });
        });

        app.post("/search", function(request, result) {
            var query = request.fields.query;

            database.collection("users").find({
                "name": {
                    $regex: ".*" + query + ".*",
                    $options: "i"
                }
            }).toArray(function(error, data) {
                result.json({
                    "status": "success",
                    "message": "Record has been fetched.",
                    "data": data
                });
            });
        });

        app.get("/allUsers", function(request, result) {
            result.render("allUsers");
        });

        app.post("/getAllUsers", function(request, result) {
            database.collection("users").find({}).toArray(function(error, data) {
                result.json({
                    "status": "success",
                    "message": "All users has been fetched.",
                    "data": data
                });
            });
        });

        app.get("/ranking", function(request, result) {
            result.render("ranking");
        });

        app.post("/getRanking", function(request, result) {
            database.collection("users").find({}).sort({
                "blue_points": -1
            }).toArray(function(error, data) {
                result.json({
                    "status": "success",
                    "message": "User ranking has been fetched.",
                    "data": data
                });
            });
        });

        app.post("/sendFriendRequest", function (request, result) {
            var accessToken = request.fields.accessToken;
            var _id = request.fields._id;

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function (error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "User has been logged out. Please login again."
                    });
                } else {
                    var me = user;
                    database.collection("users").findOne({
                        "_id": ObjectId(_id)
                    }, function (error, user) {
                        if (user == null) {
                            result.json({
                                "status": "error",
                                "message": "User does not exist."
                            })
                        } else {
                            database.collection("users").updateOne({
                                "_id": ObjectId(_id)
                            }, {
                                $push: {
                                    "friends": {
                                        "_id": me._id,
                                        "name": me.name,
                                        "profileImage": me.profileImage,
                                        "status": "Pending",
                                        "sentByMe": false,
                                        "inbox": []
                                    }
                                }
                            }, function (error, data) {
                                database.collection("users").updateOne({
                                    "_id": me._id
                                }, {
                                    $push: {
                                        "friends": {
                                            "_id": user._id,
                                            "name": user.name,
                                            "profileImage": user.profileImage,
                                            "status": "Pending",
                                            "sentByMe": true,
                                            "inbox": []
                                        }
                                    }
                                }, function (error, data) {
                                    result.json({
                                        "status": "success",
                                        "message": "Friend request has been sent."
                                    });
                                });
                            });
                        }
                    });
                }
            });
        });

        app.get("/friends", function (request, result) {
            result.render("friends");
        })

        app.post("/acceptFriendRequest", function (request, result) {
            var accessToken = request.fields.accessToken;
            var _id = request.fields._id;

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function (error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "User has been logged out. Please login again."
                    });
                } else {
                    var me = user;
                    database.collection("users").findOne({
                        "_id": ObjectId(_id)
                    }, function (error, user) {
                        if (user == null) {
                            result.json({
                                "status": "error",
                                "message": "User does not exist."
                            });
                        } else {
                            database.collection("users").updateOne({
                                "_id": ObjectId(_id)
                            }, {
                                $push: {
                                    "notifications": {
                                        "_id": ObjectId(),
                                        "type": "friend_request_accepted",
                                        "content": me.name + " accepted your friend request.",
                                        "profileImage": me.profileImage,
                                        "createdAt": new Date().getTime()
                                    }
                                }
                            });

                            database.collection("users").updateOne({
                                $and: [{
                                    "_id": ObjectId(_id)
                                }, {
                                    "friends._id": me._id
                                }]
                            }, {
                                $set: {
                                    "friends.$.status": "Accepted"
                                }
                            }, function (error, data) {
                                database.collection("users").updateOne({
                                    $and: [{
                                        "_id": me._id
                                    }, {
                                        "friends._id": user._id
                                    }]
                                }, {
                                    $set: {
                                        "friends.$.status": "Accepted"
                                    }
                                }, function (error, data) {
                                    result.json({
                                        "status": "success",
                                        "message": "Friend request has been accepted."
                                    });
                                });
                            });
                        }
                    });
                }
            });
        });

        app.post("/unfriend", function(request, result) {
            var accessToken = request.fields.accessToken;
            var _id = request.fields._id;

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function(error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "User has been logged out. Please login again."
                    });
                } else {
                    var me = user;
                    database.collection("users").findOne({
                        "_id": ObjectId(_id)
                    }, function(error, user) {
                        if (user == null) {
                            result.json({
                                "status": "error",
                                "message": "User does not exist."
                            });
                        } else {
                            database.collection("users").updateOne({
                                "_id": ObjectId(_id)
                            }, {
                                $pull: {
                                    "friends": {
                                        "_id": me._id
                                    }
                                }
                            }, function (error, data) {
                                database.collection("users").updateOne({
                                    "_id": me._id
                                }, {
                                    $pull: {
                                        "friends": {
                                            "_id": user._id
                                        }
                                    }
                                }, function (error, data) {
                                    result.json({
                                        "status": "success",
                                        "message": "Friend has been removed."
                                    });
                                });
                            });
                        }
                    });
                }
            });
        });

        app.post("/addDare" , function(request, result) {
            var accessToken = request.fields.accessToken;
            var dareID = request.fields.dareIDPost;
            var bp_dare = Number(request.fields.new_dare);

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function (error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "User has been logged out. Please login again."
                    });
                } else if (user.blue_points == 0) {
                    result.json({
                        "status": "error",
                        "message": "You do not have enough blue points left to dare. Create a dare to earn some!"
                    });
                } else {

                    database.collection("posts").findOne({
                        $and: [{
                            "dareID": dareID
                        }, {
                            "distinction": "dare"
                        }]
                    }, function(error, post) {
                        if (post == null) {
                            result.json({
                                "status": "error",
                                "message": "Dare does not exist."
                            });
                        } else {
                            
                            if (post.dare_open == false) {
                                result.json({
                                    "status": "error",
                                    "message": "Dare is not open anymore."
                                });
                            } else {
                                database.collection("users").updateOne({
                                    "accessToken": accessToken
                                }, {
                                    $set: {
                                        "blue_points": (user.blue_points - bp_dare)
                                    }
                                });
    
                                var bp_before = Number(post.bp_now);
                                var bp_goal = Number(post.bp_goal);

                                database.collection("posts").findOne({
                                    $and: [{
                                        "dareID": dareID
                                    }, {
                                        "distinction": "dare"
                                    }]
                                }, function (error, data) {
                                    database.collection("posts").findOne({
                                        $and: [{
                                            "dareID": dareID
                                        }, {
                                            "distinction": "dare"
                                        }, {
                                            "dares._id": user._id
                                        }]
                                        
                                    }, function (error, darer) {
                                        
                                        if (darer == null) {
                                            database.collection("posts").updateOne({
                                                $and: [{
                                                    "dareID": dareID
                                                }, {
                                                    "distinction": "dare"
                                                }]
                                            }, {
                                                $push: {
                                                    "dares": {
                                                        "_id": user._id,
                                                        "name": user.name,
                                                        "profileImage": user.profileImage,
                                                        "bp_dared": bp_dare
                                                    }
                                                }
                                            });
                                        } else {
                                            database.collection("posts").updateOne({
                                                $and: [{
                                                    "dareID": dareID
                                                }, {
                                                    "distinction": "dare"
                                                }, {
                                                    "dares._id": user._id
                                                }]
                                            }, {
                                                $inc: {
                                                    "dares.$.bp_dared": bp_dare
                                                }
                                            });
                                        }
                                    });
                                });

                                database.collection("posts").updateOne({
                                    $and: [{
                                        "dareID": dareID
                                    }, {
                                        "distinction": "dare"
                                    }]
                                }, {
                                    $set: {
                                        "bp_now": (bp_before + bp_dare)
                                    }
                                }, function () {
                                    if ((bp_before + bp_dare) >= bp_goal) {
                                        
                                        database.collection("posts").updateOne({
                                            $and: [{
                                                "dareID": dareID
                                            }, {
                                                "distinction": "dare"
                                            }]
                                        }, {
                                            $set: {
                                                "dare_open": false,
                                                "dare_status": "ready"
                                            }
                                        });

                                        database.collection("posts").findOne({
                                            $and: [{
                                                "dareID": dareID
                                            }, {
                                                "distinction": "dare"
                                            }]
                                        }, function(error, dare) {
                                            var thisdare = dare;
                                            result.json({
                                                "status": "success",
                                                "message": "Dare has been submitted.",
                                                "dareID": dareID,
                                                "bp_current": (bp_before + bp_dare),
                                                "bp_goal": bp_goal,
                                                "dare_status": "closed",
                                                "dare": thisdare
                                            });
                                        });
                                    } else {
                                        database.collection("posts").findOne({
                                            $and: [{
                                                "dareID": dareID
                                            }, {
                                                "distinction": "dare"
                                            }]
                                        }, function(error, dare) {
                                            var thisdare = dare;
                                            result.json({
                                                "status": "success",
                                                "message": "Dare has been submitted.",
                                                "dareID": dareID,
                                                "bp_current": (bp_before + bp_dare),
                                                "bp_goal": bp_goal,
                                                "dare_status": "open",
                                                "dare": thisdare
                                            });
                                        });

                                    }
                                });
                            }
                        }
                    });
                }
            });
        });

        app.post("/dareAccepted", function(request, result) {
            var accessToken = request.fields.accessToken;
            var dareID = request.fields.dareID;

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function (error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "User has been logged out. Please login again."
                    });
                } else {
                    database.collection("posts").findOne({
                        $and: [{
                            "dareID": dareID
                        }, {
                            "distinction": "completed"
                        }]
                    }, function(error, post) {
                        var number_of_dares = Number(post.dare_users);
                        var majority_votes = Math.ceil(number_of_dares/2);
                        var blue_points = Number(post.bp_goal);

                        database.collection("posts").findOne({
                            $and: [{
                                "dareID": dareID
                            }, {
                                "distinction": "completed"
                            }, {
                                "rejected._id": user._id
                            }]
                        }, function (error, completed) {
                            if (completed == null) {
                                var didReject = false
                            } else {
                                var didReject = true
                            }

                            if (post.accepted.length == (majority_votes - 1)) {
                                console.log("dare will be accepted");
                                //dare will be accepted, 2 options depending on didReject
                                if (didReject == true) {
                                    console.log("vote will be changed");
                                    database.collection("posts").updateOne({
                                        $and: [{
                                            "dareID": dareID
                                        }, {
                                            "distinction": "completed"
                                        }]
                                    }, {
                                        $push: {
                                            "accepted": {
                                                "_id": user._id,
                                                "name": user.name,
                                                "profileImage": user.profileImage
                                            }
                                        }
                                    }, function (error, data) {
                                        database.collection("posts").updateOne({
                                            $and: [{
                                                "dareID": dareID
                                            }, {
                                                "distinction": "completed"
                                            }]
                                        }, {
                                            $pull: {
                                                "rejected": {
                                                    "_id": user._id,
                                                }
                                            }
                                        }, function (error, data) {
                                            database.collection("posts").updateOne({
                                                $and: [{
                                                    "dareID": dareID
                                                }, {
                                                    "distinction": "completed"
                                                }]
                                            }, {
                                                $set: {
                                                    "dare_accepted": true,
                                                }
                                            }, function(error, data) {
                                                database.collection("posts").updateOne({
                                                    $and: [{
                                                        "dareID": dareID
                                                    }, {
                                                        "distinction": "dare"
                                                    }]
                                                }, {
                                                    $set: {
                                                        "dare_status": "accepted",
                                                    }
                                                }, function (error, data) {
                                                    database.collection("users").updateOne({
                                                        "_id": ObjectId(post.user._id)
                                                    }, {
                                                        $inc: {
                                                            "blue_points": blue_points
                                                        }
                                                    }, function (error, data) {
                                                        database.collection("posts").findOne({
                                                            $and: [{
                                                                "dareID": dareID
                                                            }, {
                                                                "distinction": "completed"
                                                            }]
                                                        }, function (error, data_to_send) {
                                                            result.json({
                                                                "status": "success",
                                                                "message": "Your vote was changed to accepted.",
                                                                "completed_status": "accepted",
                                                                "data": data_to_send
                                                            });
                                                        });
                                                    });
                                                });
                                            });
                                        });
                                    });
                                } else {
                                    console.log("vote will be saved");
                                    database.collection("posts").updateOne({
                                        $and: [{
                                            "dareID": dareID
                                        }, {
                                            "distinction": "completed"
                                        }]
                                    }, {
                                        $push: {
                                            "accepted": {
                                                "_id": user._id,
                                                "name": user.name,
                                                "profileImage": user.profileImage
                                            }
                                        }
                                    }, function (error, data) {
                                        database.collection("posts").updateOne({
                                            $and: [{
                                                "dareID": dareID
                                            }, {
                                                "distinction": "completed"
                                            }]
                                        }, {
                                            $set: {
                                                "dare_accepted": true,
                                            }
                                        }, function(error, data) {
                                            database.collection("posts").updateOne({
                                                $and: [{
                                                    "dareID": dareID
                                                }, {
                                                    "distinction": "dare"
                                                }]
                                            }, {
                                                $set: {
                                                    "dare_status": "accepted",
                                                }
                                            }, function (error, data) {
                                                database.collection("users").updateOne({
                                                    "_id": ObjectId(post.user._id)
                                                }, {
                                                    $inc: {
                                                        "blue_points": blue_points
                                                    }
                                                }, function (error, data) {
                                                    database.collection("posts").findOne({
                                                        $and: [{
                                                            "dareID": dareID
                                                        }, {
                                                            "distinction": "completed"
                                                        }]
                                                    }, function (error, data_to_send) {
                                                        result.json({
                                                            "status": "success",
                                                            "message": "Your vote as accepted was saved.",
                                                            "completed_status": "accepted",
                                                            "data": data_to_send
                                                        });
                                                    });
                                                });
                                            });
                                        });
                                    });
                                }
                            } else { //post will not be accepted, just save vote
                                console.log("dare not accepted yet");
                                if (didReject == true) {
                                    console.log("vote will be changed");
                                    database.collection("posts").updateOne({
                                        $and: [{
                                            "dareID": dareID
                                        }, {
                                            "distinction": "completed"
                                        }]
                                    }, {
                                        $push: {
                                            "accepted": {
                                                "_id": user._id,
                                                "name": user.name,
                                                "profileImage": user.profileImage
                                            }
                                        }
                                    }, function (error, data) {
                                        database.collection("posts").updateOne({
                                            $and: [{
                                                "dareID": dareID
                                            }, {
                                                "distinction": "completed"
                                            }]
                                        }, {
                                            $pull: {
                                                "rejected": {
                                                    "_id": user._id,
                                                }
                                            }
                                        }, function (error, data) {
                                            database.collection("posts").findOne({
                                                $and: [{
                                                    "dareID": dareID
                                                }, {
                                                    "distinction": "completed"
                                                }]
                                            }, function (error, data_to_send) {
                                                result.json({
                                                    "status": "success",
                                                    "message": "Your vote was changed to accepted.",
                                                    "completed_status": "open",
                                                    "data": data_to_send
                                                });
                                            });
                                        });
                                    });
                                } else {
                                    console.log("vote will be saved");
                                    database.collection("posts").updateOne({
                                        $and: [{
                                            "dareID": dareID
                                        }, {
                                            "distinction": "completed"
                                        }]
                                    }, {
                                        $push: {
                                            "accepted": {
                                                "_id": user._id,
                                                "name": user.name,
                                                "profileImage": user.profileImage
                                            }
                                        }
                                    }, function (error, data) {
                                        database.collection("posts").findOne({
                                            $and: [{
                                                "dareID": dareID
                                            }, {
                                                "distinction": "completed"
                                            }]
                                        }, function (error, data_to_send) {
                                            result.json({
                                                "status": "success",
                                                "message": "Your vote as accepted was saved.",
                                                "completed_status": "open",
                                                "data": data_to_send
                                            });
                                        });
                                    });
                                }
                            }
                        });                        
                    });
                }
            });
        });

        app.post("/dareRejected", function(request, result) {
            var accessToken = request.fields.accessToken;
            var dareID = request.fields.dareID;

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function (error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "User has been logged out. Please login again."
                    });
                } else {
                    database.collection("posts").findOne({
                        $and: [{
                            "dareID": dareID
                        }, {
                            "distinction": "completed"
                        }]
                    }, function(error, post) {
                        var number_of_dares = Number(post.dare_users);
                        var majority_votes = Math.ceil(number_of_dares/2);

                        database.collection("posts").findOne({
                            $and: [{
                                "dareID": dareID
                            }, {
                                "distinction": "completed"
                            }, {
                                "accepted._id": user._id
                            }]
                        }, function (error, completed) {
                            if (completed == null) {
                                var didAccept = false
                            } else {
                                var didAccept = true
                            }

                            if (post.rejected.length == (majority_votes - 1)) {
                                console.log("dare will be accepted");
                                //dare will be accepted, 2 options depending on didReject
                                if (didAccept == true) {
                                    console.log("vote will be changed");
                                    database.collection("posts").updateOne({
                                        $and: [{
                                            "dareID": dareID
                                        }, {
                                            "distinction": "completed"
                                        }]
                                    }, {
                                        $push: {
                                            "rejected": {
                                                "_id": user._id,
                                                "name": user.name,
                                                "profileImage": user.profileImage
                                            }
                                        }
                                    }, function (error, data) {
                                        database.collection("posts").updateOne({
                                            $and: [{
                                                "dareID": dareID
                                            }, {
                                                "distinction": "completed"
                                            }]
                                        }, {
                                            $pull: {
                                                "accepted": {
                                                    "_id": user._id,
                                                }
                                            }
                                        }, function (error, data) {
                                            database.collection("posts").updateOne({
                                                $and: [{
                                                    "dareID": dareID
                                                }, {
                                                    "distinction": "completed"
                                                }]
                                            }, {
                                                $set: {
                                                    "dare_rejected": true,
                                                }
                                            }, function(error, data) {
                                                database.collection("posts").updateOne({
                                                    $and: [{
                                                        "dareID": dareID
                                                    }, {
                                                        "distinction": "dare"
                                                    }]
                                                }, {
                                                    $set: {
                                                        "dare_status": "rejected",
                                                    }
                                                }, function (error, data) {

                                                    for (var c = 0; c < post.dares.length; c++) {
                                                        var darer = post.dares[c];
                                                        var blue_points = Number(darer.bp_dared);
                                                        
                                                        database.collection("users").updateOne({
                                                            "_id": ObjectId(darer._id)
                                                        }, {
                                                            $inc: {
                                                                "blue_points": blue_points
                                                            }
                                                        });
                                                    }

                                                }, function (error, data) {
                                                    database.collection("posts").findOne({
                                                        $and: [{
                                                            "dareID": dareID
                                                        }, {
                                                            "distinction": "completed"
                                                        }]
                                                    }, function (error, data_to_send) {
                                                        result.json({
                                                            "status": "success",
                                                            "message": "Your vote was changed to rejected.",
                                                            "completed_status": "rejected",
                                                            "data": data_to_send
                                                        });
                                                    });
                                                });
                                            });
                                        });
                                    });
                                } else {
                                    console.log("vote will be saved");
                                    database.collection("posts").updateOne({
                                        $and: [{
                                            "dareID": dareID
                                        }, {
                                            "distinction": "completed"
                                        }]
                                    }, {
                                        $push: {
                                            "rejected": {
                                                "_id": user._id,
                                                "name": user.name,
                                                "profileImage": user.profileImage
                                            }
                                        }
                                    }, function (error, data) {
                                        database.collection("posts").updateOne({
                                            $and: [{
                                                "dareID": dareID
                                            }, {
                                                "distinction": "completed"
                                            }]
                                        }, {
                                            $set: {
                                                "dare_rejected": true,
                                            }
                                        }, function(error, data) {
                                            database.collection("posts").updateOne({
                                                $and: [{
                                                    "dareID": dareID
                                                }, {
                                                    "distinction": "dare"
                                                }]
                                            }, {
                                                $set: {
                                                    "dare_status": "rejected",
                                                }
                                            }, function (error, data) {

                                                for (var c = 0; c < post.dares.length; c++) {
                                                    var darer = post.dares[c];
                                                    var blue_points = Number(darer.bp_dared);
                                                    
                                                    database.collection("users").updateOne({
                                                        "_id": ObjectId(darer._id)
                                                    }, {
                                                        $inc: {
                                                            "blue_points": blue_points
                                                        }
                                                    });
                                                }
                                            }, function (error, data) {
                                                database.collection("posts").findOne({
                                                    $and: [{
                                                        "dareID": dareID
                                                    }, {
                                                        "distinction": "completed"
                                                    }]
                                                }, function (error, data_to_send) {
                                                    result.json({
                                                        "status": "success",
                                                        "message": "Your vote as rejected was saved.",
                                                        "completed_status": "rejected",
                                                        "data": data_to_send
                                                    });
                                                });
                                            });
                                        });
                                    });
                                }
                            } else { //post will not be accepted, just save vote
                                console.log("dare not rejected yet");
                                if (didAccept == true) {
                                    console.log("vote will be changed");
                                    database.collection("posts").updateOne({
                                        $and: [{
                                            "dareID": dareID
                                        }, {
                                            "distinction": "completed"
                                        }]
                                    }, {
                                        $push: {
                                            "rejected": {
                                                "_id": user._id,
                                                "name": user.name,
                                                "profileImage": user.profileImage
                                            }
                                        }
                                    }, function (error, data) {
                                        database.collection("posts").updateOne({
                                            $and: [{
                                                "dareID": dareID
                                            }, {
                                                "distinction": "completed"
                                            }]
                                        }, {
                                            $pull: {
                                                "accepted": {
                                                    "_id": user._id,
                                                }
                                            }
                                        }, function (error, data) {
                                            database.collection("posts").findOne({
                                                $and: [{
                                                    "dareID": dareID
                                                }, {
                                                    "distinction": "completed"
                                                }]
                                            }, function (error, data_to_send) {
                                                result.json({
                                                    "status": "success",
                                                    "message": "Your vote was changed to rejected.",
                                                    "completed_status": "open",
                                                    "data": data_to_send
                                                });
                                            });
                                        });
                                    });
                                } else {
                                    console.log("vote will be saved");
                                    database.collection("posts").updateOne({
                                        $and: [{
                                            "dareID": dareID
                                        }, {
                                            "distinction": "completed"
                                        }]
                                    }, {
                                        $push: {
                                            "rejected": {
                                                "_id": user._id,
                                                "name": user.name,
                                                "profileImage": user.profileImage
                                            }
                                        }
                                    }, function (error, data) {
                                        database.collection("posts").findOne({
                                            $and: [{
                                                "dareID": dareID
                                            }, {
                                                "distinction": "completed"
                                            }]
                                        }, function (error, data_to_send) {
                                            result.json({
                                                "status": "success",
                                                "message": "Your vote as rejected was saved.",
                                                "completed_status": "open",
                                                "data": data_to_send
                                            });
                                        });
                                    });
                                }
                            }
                        });                        
                    });
                }
            });
        });

        app.get("/messages", function (request, result) {
            result.render("messages");
        });

        app.post("/getFriendsChat", function (request, result) {
            var accessToken = request.fields.accessToken;
            var _id = request.fields._id;

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function (error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "User has been logged out. Please login again."
                    });
                } else {
                    var index = user.friends.findIndex(function(friend) {
                        return friend._id == _id
                    });
                    var messages = user.friends[index].inbox;

                    result.json({
                        "status": "success",
                        "message": "Record has been fetched.",
                        "data": messages
                    });
                }
            });
        });

        app.post("/sendMessage", function(request, result) {
            var accessToken = request.fields.accessToken;
            var _id = request.fields._id;
            var message = request.fields.message;

            database.collection("users").findOne({
                "accessToken": accessToken
            }, function(error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "User has been logged out. Please login again."
                    });
                } else {
                    var me = user;
                    database.collection("users").findOne({
                        "_id": ObjectId(_id)
                    }, function (error, user) {
                        if (user == null) {
                            result.json({
                                "status": "error",
                                "message": "User does not exist."
                            });
                        } else {
                            database.collection("users").updateOne({
                                $and: [{
                                    "_id": ObjectId(_id)
                                }, {
                                    "friends._id": me._id
                                }]
                            }, {
                                $push: {
                                    "friends.$.inbox": {
                                        "_id": ObjectId(),
                                        "message": message,
                                        "from": me._id
                                    }
                                }
                            }, function (error, data) {
                                database.collection("users").updateOne({
                                    $and: [{
                                        "_id": me._id
                                    }, {
                                        "friends._id": user._id
                                    }]
                                }, {
                                    $push: {
                                        "friends.$.inbox": {
                                            "_id": ObjectId(),
                                            "message": message,
                                            "from": me._id
                                        }
                                    }
                                }, function(error, data) {

                                    socketIO.to(users[user._id]).emit("messageReceived", {
                                        "message": message,
                                        "from": me._id
                                    });

                                    result.json({
                                        "status": "success",
                                        "message": "Message has been sent."
                                    });
                                });
                            });
                        }
                    });
                }
            });
        });

        app.post("/connectSocket", function(request, result) {
            var accessToken = request.fields.accessToken;
            database.collection("users").findOne({
                "accessToken": accessToken
            }, function(error, user) {
                if (user == null) {
                    result.json({
                        "status": "error",
                        "message": "User has been logged out. Please loggin again."
                    });
                } else {
                    users[user._id] = socketID;
                    result.json({
                        "status": "success",
                        "message": "Socket has been connected."
                    });
                }
            });
        });

    });
});

