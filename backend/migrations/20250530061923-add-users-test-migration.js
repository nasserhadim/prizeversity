   // backend/migrations/20250530XXXXXX-add-users-test-migration.js
   module.exports = {
     async up(db) {
       // create a throw-away collection with one unique index
       await db.collection('users_test_migration').createIndex({ email: 1 }, { unique: true });
       // insert a sample doc so you can see it in Compass
       await db.collection('users_test_migration').insertOne({
         email: 'test@example.com',
         createdAt: new Date()
       });
     },
   
     async down(db) {
       // drop the entire test collection
       await db.collection('users_test_migration').drop();
     },
   };