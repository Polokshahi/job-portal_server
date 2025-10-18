const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const app = express();
const jwt = require('jsonwebtoken'); 
const port = process.env.PORT || 5000;
require('dotenv').config();

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());


// Base Route
app.get('/', (req, res) => {
  res.send('Job Portal Server is running');
});





const verifyToken = (req, res, next) =>{
  console.log("inside the veriy middleware");
  const token = req?.cookies?.token;
  if(!token){
    return res.status(401).send({message: 'Unauthorized access'})
  }


  jwt.verify(token, process.env.ACCESS_TOKEN, function(err, decoded) {
    if(err){
      return res.status(403).send({message: 'Forbidden access'})
    }

    // 
    req.user = decoded;

     next();
  
});
  





 

}








// MongoDB URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fpvzj8u.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// MongoDB Client
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect to MongoDB
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. Successfully connected to MongoDB!");

    // Collections
    const database = client.db("Job-Portal");
    const jobCollections = database.collection("Jobs");
    const jobApplicationCollection = database.collection("job-applications");





app.post('/jwt', async(req, res) => {
  const user = req.body;
  console.log(user);
  const token = jwt.sign(user, process.env.ACCESS_TOKEN, {expiresIn: '1h'});
  res.cookie('token', token, {
    httpOnly: true,
    secure: false,
  });
  res.send({success: true})

})


app.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: false
  });
  res.send({success: true})
})





















    // Get all jobs
 app.get('/jobs', async (req, res) => {
  try {
    const email = req.query.email;
    let query = {};
    
    if(email){
      query = {hr_email: email};
      
    }
    
    const jobs = await jobCollections.find(query).toArray();


    res.json(jobs);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch jobs', error: err });
  }
});

app.post('/jobs', async(req, res) =>{
  const newJob = req.body;
  const result = await jobCollections.insertOne(newJob);
  res.send(result);
})


    app.get('/jobs/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const job = await jobCollections.findOne(query);
        res.send(job);
      } catch (error) {
        res.status(500).send({ message: 'Failed to fetch job', error });
      }
    });

    app.get('/job-application', verifyToken, async (req, res) => {
      try {
         const email = req.query.email;
        let query = {};
        if (email) query = { email };

        if(req?.user?.email !== req.query.email){
          return res.status(403).send({message: 'Forbidden access'})
        }

        console.log(req.cookies);

        const result = await jobApplicationCollection.find(query).toArray();

        for (const application of result) {
          const query = { _id: new ObjectId(application.jobId) };
          const job = await jobCollections.findOne(query);
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
   
      



    // job application

    app.post('/job-application', async(req,res) =>{
      const application = req.body;
      const result = await jobApplicationCollection.insertOne(application)

      const id = application.jobId;
      const query = {_id: new ObjectId(id)};
      const job = await jobCollections.findOne(query);

      let newCount = 0;
      if(job.applicationCount){
        newCount = job.applicationCount + 1;
      }else{
        newCount = 1;
      }

      // update application count in job collection
      const filter = {_id: new ObjectId(id)};
      const updateDoc = {
        $set: {
          applicationCount : newCount
        }
       
      }
      const updateResult = await jobCollections.updateOne(filter, updateDoc);
      res.send(result, updateResult);

    })




    // email wise application get operation
    app.get('/job-application/:email', async(req, res) =>{
      const email = req.params.email;
      const query = {email: email};
      const result = await jobApplicationCollection.find(query).toArray();
      res.send(result);
    })


    app.get('/job-application/jobs/:job_Id', async(req, res) =>{
      const jobId = req.params.job_Id;
      const query = {jobId: jobId};
      const result = await jobApplicationCollection.find(query).toArray();
      res.send(result);
    })




    // patch operation

    app.patch('/job-application/:id', async(req, res) =>{
      const id  = req.params.id;
      const data = req.body;
      const filter = {_id: new ObjectId(id)};

       const updateDoc = {
      $set: {
        status: data.status
      },
    };


    const result = await jobApplicationCollection.updateOne(filter, updateDoc);
    res.send(result);



    })





  } catch (err) {
    console.error('Error connecting to MongoDB:', err);
  }
}
run().catch(console.dir);

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
