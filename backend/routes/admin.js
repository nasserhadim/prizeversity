const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../config/auth.js');
const isAdmin = require('../middleware/isAdmin.js');
const User = require('../models/User.js');
const Classroom = require('../models/Classroom.js');

// view all users
router.get('/users', ensureAuthenticated, isAdmin, async (req, res) => {
    try {
        const users = await User.find().select('-passowrd'); // Hiding password if present
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users'});
    }
});

// view all admins
router.get('/admins', ensureAuthenticated, isAdmin, async(req, res) => {
    try {
        const admins = await User.find({ role: 'admin'}).select('-password');
        res.json(admins);
    } catch (error) {
        res.status(500).json({error: 'Internal Server Error!'});
    }
});

// view all classrooms
router.get('/classrooms', ensureAuthenticated, isAdmin, async(req, res) => {
    try {
        const classrooms = await Classroom.find().populate('teacher').populate('students')
        res.json(classrooms);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch classrooms'});
    }
})

// ban user
router.patch('/ban/:userId', ensureAuthenticated, isAdmin, async (req,res) => {
    try {
        const user = await User.findByIdAndUpdate (
            req.params.userId,
            { isBanned: true},
            { new: true }
        );
        res.json({ message: `${user.email} has been banned.`, user});
    } catch (error) {
        res.status(500).json({ error: 'Failed to ban user!'});
    }
});

// unban user
router.patch('/unban/:userId', ensureAuthenticated, isAdmin, async(req,res) => {
    try {
        const user = await User.findByIdAndUpdate (
            req.params.userId,
            { isBanned: false},
            { new: true}
        );
        res.json({message: `${user.email} has been un-banned.`, user});
    } catch (error) {
        res.status(500).json({ error: 'Failed to un-ban user!'});
    }
});

// delete classrooms (if they are inactive or any other issues that class may have!)
router.delete('/classrooms/:id', ensureAuthenticated, isAdmin, async(req,res) => {
    try {
        await Classroom.findByIdAndDelete(req.params.id);
        res.json({ message: 'Classroom deleted'});
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete classroom' });
    }
});

// check all users, students, teachers, classrooms
router.get('/metrics', ensureAuthenticated, isAdmin, async(req,res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalStudents = await User.countDocuments({ role: 'student'});
        const totalTeachers = await User.countDocuments({ role: 'teacher'});
        const totalClassrooms = await Classroom.countDocuments();
        
        res.json({ totalUsers, totalStudents, totalTeachers, totalClassrooms});
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch metrics!'});
    }
});

// Here more functionalities will be implemented
// Manage classrooms
// deleting groups
// etc.

module.exports = router;