const express = require('express');
const app = express();
const cors = require('cors')
const port = 5000;
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config()
app.use(cors())
app.use(express.json())



app.get('/', (req, res) => {
    res.send('Hello World!');
});






const uri = process.env.MONGODB_URI

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const database = client.db('RentNest')
        const propertiesCollection = database.collection('properties')



        app.post('/api/properties', async (req, res) => {
            const property = req.body;
            const result = await propertiesCollection.insertOne(property)
            res.send(result)
        })


        app.get('/api/properties', async (req, res) => {
            const result = await propertiesCollection.find().toArray();
            res.send(result);
        });


        app.get("/api/properties/user/:id", async (req, res) => {
            try {
                const userId = req.params.id;

                const properties = await propertiesCollection
                    .find({
                        "owner.id": userId,
                    })
                    .toArray();

                res.send(properties);
            } catch (error) {
                console.error(error);

                res.status(500).send({
                    success: false,
                    message: "Failed to fetch user properties",
                });
            }
        });


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});