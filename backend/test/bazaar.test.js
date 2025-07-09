const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../test/server.test');
const Bazaar = require('../models/Bazaar');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: 'test' });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await Bazaar.deleteMany({});
});

describe('POST /api/classroom/:id/bazaar/create', () => {
  it('should create a bazaar if one doesn’t exist', async () => {
    const classroomId = new mongoose.Types.ObjectId(); // Use a real ObjectId
    
    const res = await request(app)
      .post(`/api/classroom/${classroomId}/bazaar/create`)
      .send({
        name: 'Cool Bazaar',
        description: 'Lots of fun stuff',
        image: 'img.jpg'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.bazaar.name).toBe('Cool Bazaar');

    const count = await Bazaar.countDocuments();
    expect(count).toBe(1);
  });

  it('should not create if one already exists', async () => {
    const classroomId = new mongoose.Types.ObjectId();
    await Bazaar.create({ 
      name: 'Existing', 
      description: 'test', 
      classroom: classroomId,
      image: 'test.jpg'
    });

    const res = await request(app)
      .post(`/api/classroom/${classroomId}/bazaar/create`)
      .send({ 
        name: 'New One', 
        description: 'test', 
        image: 'img2.jpg' 
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Bazaar already exists for this classroom');
  });
});