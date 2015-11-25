var mongo = require('mongodb').MongoClient,
    client = require('socket.io').listen(8090).sockets;
// connection code goes inside
mongo.connect('mongodb://127.0.0.1/chat', function(err, db) {
    if (err) throw err;

    console.log("Server started successfully!");

    client.on('connection', function (socket) {

        socket.on('join', function (data) {

            var user_email = data.user_email,
                user_name = data.user_name,
                photo_option = data.photo_option,
                fpass = data.fpass,
                cpass = data.cpass;

            // check for empty fields
            if (user_email === '' || cpass === '' || fpass === '') {
                socket.emit('alert', 'Whoops, you missed one!');
                return;
            }

            // check for matching passwords
            if (fpass !== cpass) {
                socket.emit('alert', 'Your passwords don\'t match.');
                return;
            }

            // create a database variable
            var users = db.collection('users');

            // create a variable to hold the data object
            users.find().sort({_id: 1}).toArray(function (err, res) {
                if (err) throw err;

                // create a flag variable
                var newUser = user_email;

                var doesUserExist = function (newUser, res) {
                    if (res.length) {
                        for (var i = 0; i < res.length; i++) {

                            var answer;

                            if (newUser === res[i].user_email) {
                                answer = "exists";
                                break;
                            } else {
                                answer = "does not exist";
                            }
                        }
                        return answer;
                    } else {

                        return answer = "does not exist";

                    }
                };

                var found = doesUserExist(newUser, res);

                if (found !== "exists") {
                    // if not found, push the user into the db
                    users.insert({
                        user_email: user_email,
                        user_name: user_name,
                        photo_option: photo_option,
                        password: cpass
                    }, function () {
                        socket.emit('alert', 'Your account has been created');
                        socket.emit('clear-login');
                        return found;
                    });
                } else {
                    socket.emit('alert', 'Username already exists. Please use another one.');
                }
            });

        });

        socket.on('login', function (login_info) {
            var this_user_email = login_info.user_email,
                this_user_password = login_info.user_password;

            if (this_user_email === '' || this_user_password === '') {
                socket.emit('alert', 'You must fill in both fields');
            } else {
                var users = db.collection('users');
                users.find().toArray(function (err, res) {
                    if (err) throw err;

                    var found = false,
                        location = -1;

                    if (res.length) {
                        for (i = 0; i < res.length; i++) {
                            if (res[i].user_email === this_user_email) {
                                found = true;

                                if (res[i].password === this_user_password) {
                                    socket.emit('redirect', 'chat.html');
                                } else {
                                    socket.emit('alert', 'Please retry password');
                                }
                                break;
                            }
                        }

                        if (!found) {
                            socket.emit('alert', 'Sorry, could not find you. Please sign up.');
                            socket.emit('redirect', 'signup.html');
                        }
                    }
                });
            }
        });
        socket.on('chat-connection', function (ss_user_email) {

            var users = db.collection('users');

            users.find({
                'user_email': ss_user_email
            }).toArray(function (err, res) {
                if (err) throw err;

                var user = res[0];

                socket.broadcast.emit('status', user.user_name + ' has just joined the chat room.');

                socket.emit('update-title', user.user_name);

                // declare a variable to hold the collection
                // and a function to update the status
                var collectn = db.collection('messages'),
                    sendStatus = function (s) {
                        socket.emit('status', s);
                    };

                // emit all the chat messages
                collectn.find().limit(50).sort({
                    _id: 1
                }).toArray(function (err, res) {
                    // if there is a problem, show the error
                    if (err) throw err;
                    // otherwise, send out the messages
                    socket.emit('output', res);


                    // wait for the input
                    socket.on('input', function (data) {

                        // values here okay
                        var email = data.email,
                            photo = user.photo_option,
                            name = user.user_name,
                            message = data.message;

                        var new_msg = {
                            email: email,
                            photo: photo,
                            name: name,
                            message: message
                        };

                        // check that message box has value
                        if (message !== "") {
                            collectn.insert(
                                new_msg,
                                function () {
                                    // emit latest message to all clients
                                    client.emit('output', [new_msg]);

                                    sendStatus({
                                        message: "Message sent",
                                        clear: true
                                    });
                                });
                        } else {
                            sendStatus('Name or message is missing');
                        }

                    });

                });

                socket.on('disconnect', function () {
                    socket.broadcast.emit('status', user.user_name + ' has just left the chat room.');
                });

            });
        });
    });

});
