// Routes definitions.

var express = require('express');
var router = express.Router();

// Simple route middleware to ensure user is authenticated.
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) return next();

    // If not authenticated, redirect user to login page.
    res.redirect('/login');
}

module.exports = function(passport, jsonWSN){
    router.get('/', ensureAuthenticated, function(req, res){
        res.render('index', { jsonWSN: jsonWSN });
    });

    router.get('/sensordata', ensureAuthenticated, function(req, res){
        res.render('sensordata', { user: req.user });
    });

    router.get('/login', function(req, res){
        // If user is already logged, then redirect him to /index page.
        //console.log(req.user);
        //console.log(typeof(req.user));
        if(req.user) {
            //console.log('if');
            res.redirect('/');
        }
        else {
            //console.log('else');
            res.render('login', { user: req.user, message: req.flash('error') });
        }
    });

    router.post('/login', passport.authenticate('local', {
        successRedirect: '/',
        failureRedirect: '/login',
        failureFlash: true
    }));

    return router;
};