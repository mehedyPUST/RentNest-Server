const express = require('express');
const app = express();
const cors = require('cors')
const port = 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()

// ✅ CORS - উন্নত
app.use(cors({
    origin: process.env.BETTER_AUTH_URL,
    credentials: true,
}))
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
        const favoritesCollection = database.collection('favorites')
        const bookingsCollection = database.collection('bookings')

        // ============================================================
        // ==================== USER APIS ==============================
        // ============================================================

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

        // ✅ GET single user by ID
        app.get('/api/user/:id', async (req, res) => {
            try {
                const { id } = req.params;
                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid user ID'
                    });
                }

                const user = await usersCollection.findOne({
                    _id: new ObjectId(id)
                });

                if (!user) {
                    return res.status(404).json({
                        success: false,
                        message: 'User not found'
                    });
                }

                res.json({
                    success: true,
                    user: user
                });
            } catch (error) {
                console.error('Error fetching user:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch user'
                });
            }
        });

        // ✅ POST - Create user
        app.post('/api/user', async (req, res) => {
            try {
                const user = req.body;
                const result = await usersCollection.insertOne(user);
                res.status(201).json({
                    success: true,
                    message: 'User created successfully',
                    user: {
                        ...user,
                        _id: result.insertedId
                    }
                });
            } catch (error) {
                console.error('Error creating user:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to create user'
                });
            }
        });

        // ✅ PATCH - Update user role
        app.patch('/api/user/:id', async (req, res) => {
            try {
                const { id } = req.params;
                const { role } = req.body;

                const validRoles = ['tenant', 'owner', 'admin'];
                if (!role || !validRoles.includes(role.toLowerCase())) {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
                    });
                }

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

        // ✅ PATCH - Update user profile
        app.patch('/api/user/profile/:id', async (req, res) => {
            try {
                const { id } = req.params;
                const updateData = req.body;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid user ID'
                    });
                }

                delete updateData._id;
                delete updateData.password;

                const result = await usersCollection.updateOne(
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
                        message: 'User not found'
                    });
                }

                const updatedUser = await usersCollection.findOne({
                    _id: new ObjectId(id)
                });

                res.json({
                    success: true,
                    message: 'Profile updated successfully',
                    user: updatedUser
                });

            } catch (error) {
                console.error('Error updating profile:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to update profile'
                });
            }
        });

        // ✅ DELETE - Delete user
        app.delete('/api/user/:id', async (req, res) => {
            try {
                const { id } = req.params;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid user ID'
                    });
                }

                const result = await usersCollection.deleteOne({
                    _id: new ObjectId(id)
                });

                if (result.deletedCount === 0) {
                    return res.status(404).json({
                        success: false,
                        message: 'User not found'
                    });
                }

                res.json({
                    success: true,
                    message: 'User deleted successfully'
                });

            } catch (error) {
                console.error('Error deleting user:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to delete user'
                });
            }
        });

        // ============================================================
        // ==================== PROPERTIES APIS ========================
        // ============================================================

        // ✅ POST - Create property
        app.post('/api/properties', async (req, res) => {
            try {
                const property = req.body;
                property.createdAt = new Date();
                property.updatedAt = new Date();
                property.status = property.status || 'pending';

                const result = await propertiesCollection.insertOne(property);
                res.status(201).json({
                    success: true,
                    message: 'Property created successfully',
                    property: {
                        ...property,
                        _id: result.insertedId
                    }
                });
            } catch (error) {
                console.error('Error creating property:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to create property'
                });
            }
        });

        // ✅ GET - All properties
        app.get('/api/properties', async (req, res) => {
            try {
                const { status, propertyType, minPrice, maxPrice, search } = req.query;
                let query = {};

                if (status) query.status = status;
                if (propertyType) query.propertyType = propertyType;
                if (minPrice || maxPrice) {
                    query.price = {};
                    if (minPrice) query.price.$gte = Number(minPrice);
                    if (maxPrice) query.price.$lte = Number(maxPrice);
                }
                if (search) {
                    query.$or = [
                        { title: { $regex: search, $options: 'i' } },
                        { location: { $regex: search, $options: 'i' } },
                        { description: { $regex: search, $options: 'i' } }
                    ];
                }

                const properties = await propertiesCollection
                    .find(query)
                    .sort({ createdAt: -1 })
                    .toArray();

                res.json({
                    success: true,
                    properties: properties,
                    count: properties.length
                });
            } catch (error) {
                console.error('Error fetching properties:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch properties'
                });
            }
        });

        // ✅ GET - Featured properties
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

        // ✅ GET - User properties
        app.get("/api/properties/user/:id", async (req, res) => {
            try {
                const userId = req.params.id;
                const properties = await propertiesCollection
                    .find({
                        "owner.id": userId,
                    })
                    .sort({ createdAt: -1 })
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

        // ✅ GET - Single property
        app.get('/api/properties/:id', async (req, res) => {
            try {
                const { id } = req.params;
                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid property ID'
                    });
                }

                const property = await propertiesCollection.findOne({
                    _id: new ObjectId(id)
                });

                if (!property) {
                    return res.status(404).json({
                        success: false,
                        message: 'Property not found'
                    });
                }

                res.json(property);
            } catch (error) {
                console.error('Error fetching property:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch property'
                });
            }
        });

        // ✅ PATCH - Approve property
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

        // ✅ PATCH - Update property
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

                delete updateData._id;
                delete updateData.createdAt;

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

        // ============================================================
        // ==================== FAVORITES APIS =========================
        // ============================================================

        // ✅ POST - Add property to favorites
        app.post('/api/favorites', async (req, res) => {
            try {
                const { tenantId, propertyId, propertyData } = req.body;

                if (!tenantId || !propertyId) {
                    return res.status(400).json({
                        success: false,
                        message: 'tenantId and propertyId are required'
                    });
                }

                const existingFavorite = await favoritesCollection.findOne({
                    tenantId: tenantId,
                    propertyId: propertyId
                });

                if (existingFavorite) {
                    return res.status(400).json({
                        success: false,
                        message: 'Property already in favorites'
                    });
                }

                const favorite = {
                    tenantId: tenantId,
                    propertyId: propertyId,
                    propertyData: propertyData || null,
                    createdAt: new Date()
                };

                const result = await favoritesCollection.insertOne(favorite);

                res.status(201).json({
                    success: true,
                    message: 'Property added to favorites',
                    favorite: {
                        ...favorite,
                        _id: result.insertedId
                    }
                });

            } catch (error) {
                console.error('Error adding favorite:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to add favorite'
                });
            }
        });

        // ✅ DELETE - Remove property from favorites
        app.delete('/api/favorites/:propertyId', async (req, res) => {
            try {
                const { propertyId } = req.params;
                const { tenantId } = req.query;

                if (!tenantId) {
                    return res.status(400).json({
                        success: false,
                        message: 'tenantId is required'
                    });
                }

                const result = await favoritesCollection.deleteOne({
                    tenantId: tenantId,
                    propertyId: propertyId
                });

                if (result.deletedCount === 0) {
                    return res.status(404).json({
                        success: false,
                        message: 'Favorite not found'
                    });
                }

                res.json({
                    success: true,
                    message: 'Property removed from favorites'
                });

            } catch (error) {
                console.error('Error removing favorite:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to remove favorite'
                });
            }
        });

        // ✅ GET - Check if property is favorited
        app.get('/api/favorites/check/:propertyId', async (req, res) => {
            try {
                const { propertyId } = req.params;
                const { tenantId } = req.query;

                if (!tenantId) {
                    return res.json({
                        isFavorited: false
                    });
                }

                const favorite = await favoritesCollection.findOne({
                    tenantId: tenantId,
                    propertyId: propertyId
                });

                res.json({
                    isFavorited: !!favorite
                });

            } catch (error) {
                console.error('Error checking favorite:', error);
                res.json({
                    isFavorited: false
                });
            }
        });

        // ✅ GET - Get all favorites for a specific tenant
        app.get('/api/favorites/my-favorites', async (req, res) => {
            try {
                const { tenantId, page = 1, limit = 10 } = req.query;

                if (!tenantId) {
                    return res.status(400).json({
                        success: false,
                        message: 'tenantId is required'
                    });
                }

                const skip = (parseInt(page) - 1) * parseInt(limit);

                const totalCount = await favoritesCollection.countDocuments({
                    tenantId: tenantId
                });

                const favorites = await favoritesCollection
                    .find({ tenantId: tenantId })
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(parseInt(limit))
                    .toArray();

                const propertyIds = favorites.map(fav => fav.propertyId);
                const properties = await propertiesCollection
                    .find({ _id: { $in: propertyIds.map(id => new ObjectId(id)) } })
                    .toArray();

                const favoriteProperties = favorites.map(fav => {
                    const property = properties.find(p =>
                        p._id.toString() === fav.propertyId
                    );
                    return {
                        ...fav,
                        propertyDetails: property || null
                    };
                });

                res.json({
                    success: true,
                    favorites: favoriteProperties,
                    pagination: {
                        currentPage: parseInt(page),
                        totalPages: Math.ceil(totalCount / parseInt(limit)),
                        totalItems: totalCount,
                        itemsPerPage: parseInt(limit)
                    }
                });

            } catch (error) {
                console.error('Error fetching favorites:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch favorites'
                });
            }
        });

        // ✅ GET - Get all favorites with full property details (no pagination)
        app.get('/api/favorites/all/:tenantId', async (req, res) => {
            try {
                const { tenantId } = req.params;

                const favorites = await favoritesCollection
                    .find({ tenantId: tenantId })
                    .sort({ createdAt: -1 })
                    .toArray();

                const propertyIds = favorites.map(fav => fav.propertyId);
                const properties = await propertiesCollection
                    .find({ _id: { $in: propertyIds.map(id => new ObjectId(id)) } })
                    .toArray();

                const favoriteProperties = favorites.map(fav => {
                    const property = properties.find(p =>
                        p._id.toString() === fav.propertyId
                    );
                    return {
                        ...fav,
                        propertyDetails: property || null
                    };
                });

                res.json({
                    success: true,
                    favorites: favoriteProperties,
                    count: favoriteProperties.length
                });

            } catch (error) {
                console.error('Error fetching all favorites:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch favorites'
                });
            }
        });

        // ✅ GET - Get favorite count for a property
        app.get('/api/favorites/count/:propertyId', async (req, res) => {
            try {
                const { propertyId } = req.params;

                const count = await favoritesCollection.countDocuments({
                    propertyId: propertyId
                });

                res.json({
                    success: true,
                    count: count
                });

            } catch (error) {
                console.error('Error counting favorites:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to count favorites'
                });
            }
        });

        // ============================================================
        // ==================== BOOKINGS APIS ==========================
        // ============================================================

        // ✅ POST - Create new booking (Payment support সহ)
        app.post('/api/bookings', async (req, res) => {
            try {
                const {
                    propertyId,
                    moveInDate,
                    contactNumber,
                    additionalNotes,
                    tenantInfo,
                    paymentStatus,
                    paymentSessionId,
                    bookingStatus
                } = req.body;

                console.log('📥 Booking Request:', req.body);

                if (!propertyId || !moveInDate || !contactNumber || !tenantInfo) {
                    return res.status(400).json({
                        success: false,
                        message: 'Property ID, move-in date, contact number and tenant info are required'
                    });
                }

                const property = await propertiesCollection.findOne({
                    _id: new ObjectId(propertyId)
                });

                if (!property) {
                    return res.status(404).json({
                        success: false,
                        message: 'Property not found'
                    });
                }

                // Check if already booked
                const existingBooking = await bookingsCollection.findOne({
                    propertyId: propertyId,
                    tenantId: tenantInfo?.id,
                    bookingStatus: { $in: ['pending', 'confirmed'] }
                });

                if (existingBooking) {
                    return res.status(400).json({
                        success: false,
                        message: 'You have already booked this property'
                    });
                }

                const booking = {
                    propertyId: propertyId,
                    tenantId: tenantInfo?.id || 'unknown',
                    ownerId: property.owner?.id || 'unknown',
                    propertyInfo: {
                        title: property.title,
                        price: property.price,
                        location: property.location,
                        images: property.images || []
                    },
                    moveInDate: new Date(moveInDate),
                    contactNumber: contactNumber,
                    additionalNotes: additionalNotes || '',
                    tenantInfo: {
                        name: tenantInfo?.name || 'Unknown',
                        email: tenantInfo?.email || 'No email',
                        phone: tenantInfo?.phone || contactNumber
                    },
                    bookingStatus: bookingStatus || 'pending',
                    paymentStatus: paymentStatus || 'pending',
                    paymentSessionId: paymentSessionId || null,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                if (paymentStatus === 'paid') {
                    booking.paymentDate = new Date();
                }

                const result = await bookingsCollection.insertOne(booking);

                res.status(201).json({
                    success: true,
                    message: 'Booking created successfully',
                    booking: {
                        ...booking,
                        _id: result.insertedId
                    }
                });

            } catch (error) {
                console.error('❌ Error creating booking:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to create booking',
                    error: error.message
                });
            }
        });

        // ✅ GET - Check if property is already booked
        app.get('/api/bookings/check/:propertyId', async (req, res) => {
            try {
                const { propertyId } = req.params;
                const { tenantId } = req.query;

                if (!tenantId || !propertyId) {
                    return res.json({
                        isBooked: false,
                        message: 'Missing required parameters'
                    });
                }

                const existingBooking = await bookingsCollection.findOne({
                    propertyId: propertyId,
                    tenantId: tenantId,
                    bookingStatus: { $in: ['pending', 'confirmed'] }
                });

                res.json({
                    isBooked: !!existingBooking,
                    booking: existingBooking || null
                });

            } catch (error) {
                console.error('Error checking booking:', error);
                res.json({
                    isBooked: false,
                    error: error.message
                });
            }
        });

        // ✅ GET - Get all bookings for a tenant
        app.get('/api/bookings/my-bookings', async (req, res) => {
            try {
                const { tenantId, page = 1, limit = 10 } = req.query;

                if (!tenantId) {
                    return res.status(400).json({
                        success: false,
                        message: 'tenantId is required'
                    });
                }

                const skip = (parseInt(page) - 1) * parseInt(limit);

                const totalCount = await bookingsCollection.countDocuments({
                    tenantId: tenantId
                });

                const bookings = await bookingsCollection
                    .find({ tenantId: tenantId })
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(parseInt(limit))
                    .toArray();

                const bookingsWithDetails = await Promise.all(bookings.map(async (booking) => {
                    try {
                        const property = await propertiesCollection.findOne({
                            _id: new ObjectId(booking.propertyId)
                        });
                        return {
                            ...booking,
                            propertyDetails: property || null
                        };
                    } catch (err) {
                        return {
                            ...booking,
                            propertyDetails: null
                        };
                    }
                }));

                res.json({
                    success: true,
                    bookings: bookingsWithDetails,
                    pagination: {
                        currentPage: parseInt(page),
                        totalPages: Math.ceil(totalCount / parseInt(limit)),
                        totalItems: totalCount,
                        itemsPerPage: parseInt(limit)
                    }
                });

            } catch (error) {
                console.error('Error fetching bookings:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch bookings'
                });
            }
        });

        // ✅ GET - Get bookings for owner (landlord)
        app.get('/api/bookings/owner/:ownerId', async (req, res) => {
            try {
                const { ownerId } = req.params;
                const { status } = req.query;

                const query = { ownerId: ownerId };
                if (status) query.bookingStatus = status;

                const bookings = await bookingsCollection
                    .find(query)
                    .sort({ createdAt: -1 })
                    .toArray();

                const bookingsWithDetails = await Promise.all(bookings.map(async (booking) => {
                    try {
                        const property = await propertiesCollection.findOne({
                            _id: new ObjectId(booking.propertyId)
                        });
                        return {
                            ...booking,
                            propertyDetails: property || null
                        };
                    } catch (err) {
                        return {
                            ...booking,
                            propertyDetails: null
                        };
                    }
                }));

                res.json({
                    success: true,
                    bookings: bookingsWithDetails,
                    count: bookingsWithDetails.length
                });

            } catch (error) {
                console.error('Error fetching owner bookings:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch bookings'
                });
            }
        });

        // ✅ GET - Get single booking details
        app.get('/api/bookings/:id', async (req, res) => {
            try {
                const { id } = req.params;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid booking ID'
                    });
                }

                const booking = await bookingsCollection.findOne({
                    _id: new ObjectId(id)
                });

                if (!booking) {
                    return res.status(404).json({
                        success: false,
                        message: 'Booking not found'
                    });
                }

                let property = null;
                try {
                    property = await propertiesCollection.findOne({
                        _id: new ObjectId(booking.propertyId)
                    });
                } catch (err) {
                    console.error('Error fetching property:', err);
                }

                res.json({
                    success: true,
                    booking: {
                        ...booking,
                        propertyDetails: property || null
                    }
                });

            } catch (error) {
                console.error('Error fetching booking:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch booking'
                });
            }
        });

        // ✅ PATCH - Update booking status (Approve/Reject/Confirm)
        app.patch('/api/bookings/:id/status', async (req, res) => {
            try {
                const { id } = req.params;
                const { status, rejectionReason } = req.body;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid booking ID'
                    });
                }

                const validStatuses = ['approved', 'rejected', 'cancelled', 'confirmed', 'pending'];
                if (!validStatuses.includes(status)) {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
                    });
                }

                const updateData = {
                    bookingStatus: status,
                    updatedAt: new Date()
                };

                if (status === 'approved' || status === 'confirmed') {
                    updateData.approvedAt = new Date();
                } else if (status === 'rejected') {
                    updateData.rejectedAt = new Date();
                    updateData.rejectionReason = rejectionReason || 'No reason provided';
                } else if (status === 'cancelled') {
                    updateData.cancelledAt = new Date();
                }

                const result = await bookingsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updateData }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).json({
                        success: false,
                        message: 'Booking not found'
                    });
                }

                const updatedBooking = await bookingsCollection.findOne({
                    _id: new ObjectId(id)
                });

                res.json({
                    success: true,
                    message: `Booking ${status} successfully`,
                    booking: updatedBooking
                });

            } catch (error) {
                console.error('Error updating booking status:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to update booking status'
                });
            }
        });

        // ✅ PATCH - Update payment status
        app.patch('/api/bookings/:id/payment', async (req, res) => {
            try {
                const { id } = req.params;
                const { paymentStatus, sessionId } = req.body;

                console.log('💰 Updating payment:', { id, paymentStatus, sessionId });

                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid booking ID'
                    });
                }

                const result = await bookingsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $set: {
                            paymentStatus: paymentStatus || 'paid',
                            paymentSessionId: sessionId,
                            bookingStatus: 'confirmed',
                            updatedAt: new Date(),
                            paymentDate: new Date()
                        }
                    }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).json({
                        success: false,
                        message: 'Booking not found'
                    });
                }

                const updatedBooking = await bookingsCollection.findOne({
                    _id: new ObjectId(id)
                });

                res.json({
                    success: true,
                    message: 'Payment status updated',
                    booking: updatedBooking
                });

            } catch (error) {
                console.error('❌ Error updating payment:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to update payment status',
                    error: error.message
                });
            }
        });

        // ✅ DELETE - Cancel booking
        app.delete('/api/bookings/:id', async (req, res) => {
            try {
                const { id } = req.params;
                const { tenantId } = req.query;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid booking ID'
                    });
                }

                const booking = await bookingsCollection.findOne({
                    _id: new ObjectId(id)
                });

                if (!booking) {
                    return res.status(404).json({
                        success: false,
                        message: 'Booking not found'
                    });
                }

                if (booking.bookingStatus !== 'pending') {
                    return res.status(400).json({
                        success: false,
                        message: 'Only pending bookings can be cancelled'
                    });
                }

                await bookingsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $set: {
                            bookingStatus: 'cancelled',
                            cancelledAt: new Date(),
                            updatedAt: new Date()
                        }
                    }
                );

                res.json({
                    success: true,
                    message: 'Booking cancelled successfully'
                });

            } catch (error) {
                console.error('Error cancelling booking:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to cancel booking'
                });
            }
        });

        // ============================================================
        // ==================== DASHBOARD STATS ========================
        // ============================================================

        // ✅ GET - Admin dashboard stats
        app.get('/api/admin/stats', async (req, res) => {
            try {
                const totalUsers = await usersCollection.countDocuments();
                const totalProperties = await propertiesCollection.countDocuments();
                const pendingProperties = await propertiesCollection.countDocuments({ status: 'pending' });
                const totalBookings = await bookingsCollection.countDocuments();
                const confirmedBookings = await bookingsCollection.countDocuments({ bookingStatus: 'confirmed' });

                res.json({
                    success: true,
                    stats: {
                        totalUsers,
                        totalProperties,
                        pendingProperties,
                        totalBookings,
                        confirmedBookings
                    }
                });

            } catch (error) {
                console.error('Error fetching stats:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch stats'
                });
            }
        });

        // ✅ GET - Owner dashboard stats
        app.get('/api/owner/stats/:ownerId', async (req, res) => {
            try {
                const { ownerId } = req.params;

                const totalProperties = await propertiesCollection.countDocuments({
                    'owner.id': ownerId
                });

                const totalBookings = await bookingsCollection.countDocuments({
                    ownerId: ownerId
                });

                const pendingBookings = await bookingsCollection.countDocuments({
                    ownerId: ownerId,
                    bookingStatus: 'pending'
                });

                const confirmedBookings = await bookingsCollection.countDocuments({
                    ownerId: ownerId,
                    bookingStatus: 'confirmed'
                });

                res.json({
                    success: true,
                    stats: {
                        totalProperties,
                        totalBookings,
                        pendingBookings,
                        confirmedBookings
                    }
                });

            } catch (error) {
                console.error('Error fetching owner stats:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch stats'
                });
            }
        });

        // ============================================================
        // ==================== DATABASE PING ==========================
        // ============================================================

        await client.db("admin").command({ ping: 1 });
        console.log("✅ Pinged MongoDB! Connection successful!");

    } catch (error) {
        console.error("❌ Error:", error);
    }
}

run().catch(console.dir);

app.listen(port, () => {
    console.log(`🚀 Server is running on port ${port}`);
});