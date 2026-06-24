const express = require('express');
const app = express();
const cors = require('cors')
const port = 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
    res.send('Hello World!');
});

const uri = process.env.MONGODB_URI

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect();

        const database = client.db('RentNest')
        const propertiesCollection = database.collection('properties')
        const usersCollection = database.collection('user');

        // ✅ GET all users
        app.get('/api/user', async (req, res) => {
            try {
                const user = await usersCollection.find().toArray();
                res.json({
                    success: true,
                    user: user
                });
            } catch (error) {
                console.error('Error fetching users:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch users'
                });
            }
        });

        // ✅ PATCH - Update user role (using /api/user/:id)
        app.patch('/api/user/:id', async (req, res) => {
            try {
                const { id } = req.params;
                const { role } = req.body;

                // Validate role
                const validRoles = ['tenant', 'owner', 'admin'];
                if (!role || !validRoles.includes(role.toLowerCase())) {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
                    });
                }

                // Update user role
                const result = await usersCollection.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $set: {
                            role: role.toLowerCase(),
                            updatedAt: new Date()
                        }
                    }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).json({
                        success: false,
                        message: 'User not found'
                    });
                }

                // Get updated user
                const updatedUser = await usersCollection.findOne({
                    _id: new ObjectId(id)
                });

                res.json({
                    success: true,
                    message: `User role updated to ${role}`,
                    user: updatedUser
                });

            } catch (error) {
                console.error('Error updating user role:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to update user role'
                });
            }
        });

        app.post('/api/properties', async (req, res) => {
            const property = req.body;
            const result = await propertiesCollection.insertOne(property)
            res.send(result)
        })

        app.get('/api/properties', async (req, res) => {
            const result = await propertiesCollection.find().toArray();
            res.send(result);
        });


        // featured properties 

        app.get('/api/properties/featured', async (req, res) => {
            try {
                const properties = await propertiesCollection
                    .find({ status: 'approved' })
                    .limit(6)
                    .sort({ createdAt: -1 })
                    .toArray();

                res.json({
                    success: true,
                    properties: properties,
                    count: properties.length
                });
            } catch (error) {
                console.error('Error fetching featured properties:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch featured properties'
                });
            }
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



        app.patch('/api/properties/:id/approve', async (req, res) => {
            try {
                const { id } = req.params;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid property ID'
                    });
                }

                const result = await propertiesCollection.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $set: {
                            status: 'approved',
                            approvedAt: new Date(),
                            updatedAt: new Date()
                        }
                    }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).json({
                        success: false,
                        message: 'Property not found'
                    });
                }

                const updatedProperty = await propertiesCollection.findOne({
                    _id: new ObjectId(id)
                });

                res.json({
                    success: true,
                    message: 'Property approved successfully',
                    property: updatedProperty
                });
            } catch (error) {
                console.error('Error approving property:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to approve property'
                });
            }
        });

        // ✅ PATCH - Reject property
        app.patch('/api/properties/:id/reject', async (req, res) => {
            try {
                const { id } = req.params;
                const { rejectionReason } = req.body;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid property ID'
                    });
                }

                const result = await propertiesCollection.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $set: {
                            status: 'rejected',
                            rejectionReason: rejectionReason || 'No reason provided',
                            rejectedAt: new Date(),
                            updatedAt: new Date()
                        }
                    }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).json({
                        success: false,
                        message: 'Property not found'
                    });
                }

                const updatedProperty = await propertiesCollection.findOne({
                    _id: new ObjectId(id)
                });

                res.json({
                    success: true,
                    message: 'Property rejected successfully',
                    property: updatedProperty
                });
            } catch (error) {
                console.error('Error rejecting property:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to reject property'
                });
            }
        });

        // ✅ PATCH - Update property (Edit)
        app.patch('/api/properties/:id', async (req, res) => {
            try {
                const { id } = req.params;
                const updateData = req.body;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid property ID'
                    });
                }

                // Remove _id from updateData if present
                delete updateData._id;

                const result = await propertiesCollection.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $set: {
                            ...updateData,
                            updatedAt: new Date()
                        }
                    }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).json({
                        success: false,
                        message: 'Property not found'
                    });
                }

                const updatedProperty = await propertiesCollection.findOne({
                    _id: new ObjectId(id)
                });

                res.json({
                    success: true,
                    message: 'Property updated successfully',
                    property: updatedProperty
                });
            } catch (error) {
                console.error('Error updating property:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to update property'
                });
            }
        });

        // ✅ DELETE - Delete property
        app.delete('/api/properties/:id', async (req, res) => {
            try {
                const { id } = req.params;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid property ID'
                    });
                }

                const result = await propertiesCollection.deleteOne({
                    _id: new ObjectId(id)
                });

                if (result.deletedCount === 0) {
                    return res.status(404).json({
                        success: false,
                        message: 'Property not found'
                    });
                }

                res.json({
                    success: true,
                    message: 'Property deleted successfully'
                });
            } catch (error) {
                console.error('Error deleting property:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to delete property'
                });
            }
        });



        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // await client.close();
    }
}
run().catch(console.dir);

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});