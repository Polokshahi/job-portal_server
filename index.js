const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken'); 
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors(
  { origin: 'http://localhost:5173', credentials: true }
));
app.use(express.json());
app.use(cookieParser());

// Base Route
app.get('/', (req, res) => res.send('Job Portal Server is running'));

// Verify JWT Middleware
const verifyToken = (req, res, next) => {
  console.log("inside the verify middleware");
  const token = req?.cookies?.token;
  if (!token) return res.status(401).send({ message: 'Unauthorized access' });
  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
    if (err) return res.status(403).send({ message: 'Forbidden access' });
    req.user = decoded;
    next();
  });
}

// MongoDB Setup
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fpvzj8u.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
});

async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. Successfully connected to MongoDB!");

    const database = client.db("Job-Portal");
    const jobCollections = database.collection("Jobs");
    const jobApplicationCollection = database.collection("job-applications");

    // JWT Routes
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: '1h' });
      res.cookie('token', token, { httpOnly: true, secure: false });
      res.send({ success: true });
    });

    app.post('/logout', (req, res) => {
      res.clearCookie('token', { httpOnly: true, secure: false });
      res.send({ success: true });
    });

    // Jobs Routes
    app.get('/jobs', async (req, res) => {
      try {
        const email = req.query.email;
        let query = email ? { hr_email: email } : {};
        const jobs = await jobCollections.find(query).toArray();
        res.json(jobs);
      } catch (err) {
        res.status(500).json({ message: 'Failed to fetch jobs', error: err });
      }
    });

    app.post('/jobs', async (req, res) => {
      const newJob = req.body;
      const result = await jobCollections.insertOne(newJob);
      res.send(result);
    });

    app.get('/jobs/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const job = await jobCollections.findOne({ _id: new ObjectId(id) });
        res.send(job);
      } catch (error) {
        res.status(500).send({ message: 'Failed to fetch job', error });
      }
    });

    // Job Applications Routes
    app.get('/job-application', verifyToken, async (req, res) => {
      try {
        const email = req.query.email;
        if (req?.user?.email !== email) return res.status(403).send({ message: 'Forbidden access' });
        const result = await jobApplicationCollection.find(email ? { email } : {}).toArray();

        for (const application of result) {
          const job = await jobCollections.findOne({ _id: new ObjectId(application.jobId) });
          if (job) {
            application.jobTitle = job.title;
            application.companyName = job.companyName;
            application.location = job.location;
            application.salary = job.salary;
            application.jobType = job.jobType;
            application.postedDate = job.postedDate;
            application.company_logo = job.company_logo;
          }
        }
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: 'Failed to fetch applications', error: err });
      }
    });

    app.post('/job-application', async (req, res) => {
      const application = req.body;
      const result = await jobApplicationCollection.insertOne(application);

      const job = await jobCollections.findOne({ _id: new ObjectId(application.jobId) });
      const newCount = job?.applicationCount ? job.applicationCount + 1 : 1;
      await jobCollections.updateOne(
        { _id: new ObjectId(application.jobId) },
        { $set: { applicationCount: newCount } }
      );
      res.send(result);
    });

    app.get('/job-application/:email', async (req, res) => {
      const result = await jobApplicationCollection.find({ email: req.params.email }).toArray();
      res.send(result);
    });

    app.get('/job-application/jobs/:job_Id', async (req, res) => {
      const result = await jobApplicationCollection.find({ jobId: req.params.job_Id }).toArray();
      res.send(result);
    });

    app.patch('/job-application/:id', async (req, res) => {
      const filter = { _id: new ObjectId(req.params.id) };
      const updateDoc = { $set: { status: req.body.status } };
      const result = await jobApplicationCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

  } catch (err) {
    console.error('Error connecting to MongoDB:', err);
  }
}
run().catch(console.dir);

// Start server
app.listen(port, () => console.log(`Server is running on port ${port}`));
