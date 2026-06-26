const express = require('express');
const app = express();
const cors = require('cors')
const port = 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()

// ✅ Stripe (Frontend Stripe এর জন্য session create করতে)
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// ✅ CORS
app.use(cors({
    origin: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
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
        strict: false,
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
        const reviewsCollection = database.collection('reviews')

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

        // ✅ GET - All properties with full filtering, search, and sorting
        app.get('/api/properties', async (req, res) => {
            try {
                const {
                    search,
                    location,
                    propertyType,
                    minPrice,
                    maxPrice,
                    bedrooms,
                    bathrooms,
                    sortBy,
                    sortOrder,
                    status,
                    isAdmin,
                    isOwner,
                    ownerId,
                    page = 1,
                    limit = 20
                } = req.query;

                let query = {};

                // ✅ মূল Logic
                if (isAdmin === 'true') {
                    // Admin: সব প্রপার্টি
                    if (status && status !== 'all') {
                        query.status = status;
                    }
                } else if (isOwner === 'true' && ownerId) {
                    // ✅ Owner: নিজের সব প্রপার্টি (pending + approved + rejected)
                    query.$or = [
                        { 'ownerId': ownerId },
                        { 'owner.id': ownerId }
                    ];
                    if (status && status !== 'all') {
                        query.status = status;
                    }
                } else {
                    // Public: শুধু approved
                    query.status = 'approved';
                }

                // ===== SEARCH FUNCTIONALITY =====
                if (search) {
                    const searchRegex = { $regex: search, $options: 'i' };
                    query.$or = query.$or || [];
                    query.$or.push(
                        { title: searchRegex },
                        { description: searchRegex },
                        { location: searchRegex },
                        { 'address.city': searchRegex },
                        { 'address.state': searchRegex },
                        { 'address.zipCode': searchRegex },
                        { 'address.fullAddress': searchRegex }
                    );
                }

                // ===== LOCATION FILTER =====
                if (location) {
                    const locationRegex = { $regex: location, $options: 'i' };
                    if (query.$or) {
                        query.$or.push(
                            { location: locationRegex },
                            { 'address.city': locationRegex },
                            { 'address.state': locationRegex },
                            { 'address.zipCode': locationRegex },
                            { 'address.fullAddress': locationRegex }
                        );
                    } else {
                        query.$or = [
                            { location: locationRegex },
                            { 'address.city': locationRegex },
                            { 'address.state': locationRegex },
                            { 'address.zipCode': locationRegex },
                            { 'address.fullAddress': locationRegex }
                        ];
                    }
                }

                // ===== PROPERTY TYPE FILTER =====
                if (propertyType) {
                    query.propertyType = { $regex: `^${propertyType}$`, $options: 'i' };
                }

                // ===== PRICE RANGE FILTER =====
                if (minPrice || maxPrice) {
                    query.price = {};
                    if (minPrice) query.price.$gte = parseFloat(minPrice);
                    if (maxPrice) query.price.$lte = parseFloat(maxPrice);
                }

                // ===== BEDROOMS FILTER =====
                if (bedrooms) {
                    query['specifications.bedrooms'] = { $gte: parseInt(bedrooms) };
                }

                // ===== BATHROOMS FILTER =====
                if (bathrooms) {
                    query['specifications.bathrooms'] = { $gte: parseInt(bathrooms) };
                }

                // ===== SORT BUILDING =====
                let sort = {};
                const sortField = sortBy || 'createdAt';
                const sortDirection = sortOrder === 'asc' ? 1 : -1;

                switch (sortField) {
                    case 'price':
                        sort.price = 1;
                        break;
                    case 'priceDesc':
                        sort.price = -1;
                        break;
                    case 'title':
                        sort.title = 1;
                        break;
                    case 'bedrooms':
                        sort['specifications.bedrooms'] = -1;
                        break;
                    default:
                        sort.createdAt = sortDirection;
                        break;
                }

                // ===== PAGINATION =====
                const skip = (parseInt(page) - 1) * parseInt(limit);
                const limitNum = parseInt(limit);

                // ===== EXECUTE QUERY =====
                console.log('📊 Query:', JSON.stringify(query, null, 2));
                console.log('📊 Sort:', JSON.stringify(sort, null, 2));

                const totalCount = await propertiesCollection.countDocuments(query);
                const properties = await propertiesCollection
                    .find(query)
                    .sort(sort)
                    .skip(skip)
                    .limit(limitNum)
                    .toArray();

                res.json({
                    success: true,
                    properties: properties,
                    count: properties.length,
                    pagination: {
                        currentPage: parseInt(page),
                        totalPages: Math.ceil(totalCount / limitNum),
                        totalItems: totalCount,
                        itemsPerPage: limitNum
                    },
                    filters: {
                        search: search || null,
                        location: location || null,
                        propertyType: propertyType || null,
                        minPrice: minPrice || null,
                        maxPrice: maxPrice || null,
                        bedrooms: bedrooms || null,
                        bathrooms: bathrooms || null,
                        sortBy: sortField,
                        sortOrder: sortOrder || 'desc',
                        isAdmin: isAdmin || false,
                        isOwner: isOwner || false
                    }
                });

            } catch (error) {
                console.error('❌ Error fetching properties:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch properties',
                    error: error.message
                });
            }
        });

        // ✅ GET - Property types with counts
        app.get('/api/properties/types', async (req, res) => {
            try {
                const types = await propertiesCollection.aggregate([
                    { $match: { status: 'approved' } },
                    { $group: { _id: '$propertyType', count: { $sum: 1 } } },
                    { $sort: { _id: 1 } }
                ]).toArray();

                res.json({
                    success: true,
                    types: types.map(t => ({
                        type: t._id || 'Unknown',
                        count: t.count
                    }))
                });

            } catch (error) {
                console.error('Error fetching property types:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch property types'
                });
            }
        });

        // ✅ GET - Locations with counts
        app.get('/api/properties/locations', async (req, res) => {
            try {
                const locations = await propertiesCollection.aggregate([
                    { $match: { status: 'approved' } },
                    { $group: { _id: '$location', count: { $sum: 1 } } },
                    { $sort: { count: -1 } },
                    { $limit: 20 }
                ]).toArray();

                res.json({
                    success: true,
                    locations: locations.map(l => ({
                        location: l._id || 'Unknown',
                        count: l.count
                    }))
                });

            } catch (error) {
                console.error('Error fetching locations:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch locations'
                });
            }
        });

        // ✅ GET - Price range stats
        app.get('/api/properties/price-stats', async (req, res) => {
            try {
                const stats = await propertiesCollection.aggregate([
                    { $match: { status: 'approved' } },
                    {
                        $group: {
                            _id: null,
                            minPrice: { $min: '$price' },
                            maxPrice: { $max: '$price' },
                            avgPrice: { $avg: '$price' }
                        }
                    }
                ]).toArray();

                const result = stats[0] || { minPrice: 0, maxPrice: 1000000, avgPrice: 0 };

                res.json({
                    success: true,
                    stats: {
                        minPrice: result.minPrice || 0,
                        maxPrice: result.maxPrice || 1000000,
                        avgPrice: Math.round(result.avgPrice || 0)
                    }
                });

            } catch (error) {
                console.error('Error fetching price stats:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch price stats'
                });
            }
        });

        // ✅ GET - Search suggestions
        app.get('/api/properties/suggestions', async (req, res) => {
            try {
                const { q, limit = 10 } = req.query;

                if (!q || q.length < 2) {
                    return res.json({
                        success: true,
                        suggestions: []
                    });
                }

                const regex = { $regex: q, $options: 'i' };

                const suggestions = await propertiesCollection.aggregate([
                    {
                        $match: {
                            status: 'approved',
                            $or: [
                                { title: regex },
                                { location: regex },
                                { 'address.city': regex },
                                { 'address.state': regex }
                            ]
                        }
                    },
                    {
                        $project: {
                            title: 1,
                            location: 1,
                            city: '$address.city',
                            state: '$address.state'
                        }
                    },
                    { $limit: parseInt(limit) }
                ]).toArray();

                res.json({
                    success: true,
                    suggestions: suggestions.map(s => ({
                        title: s.title,
                        location: s.location || s.city || s.state || ''
                    }))
                });

            } catch (error) {
                console.error('Error fetching suggestions:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch suggestions'
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

        // ✅ GET - User properties (by ownerId)
        app.get("/api/properties/user/:id", async (req, res) => {
            try {
                const userId = req.params.id;
                const properties = await propertiesCollection
                    .find({
                        $or: [
                            { 'ownerId': userId },
                            { 'owner.id': userId }
                        ]
                    })
                    .sort({ createdAt: -1 })
                    .toArray();
                res.json({
                    success: true,
                    properties: properties,
                    count: properties.length
                });
            } catch (error) {
                console.error(error);
                res.status(500).json({
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

        // ✅ POST - Create new booking
        app.post('/api/bookings', async (req, res) => {
            try {
                const {
                    propertyId,
                    moveInDate,
                    contactNumber,
                    additionalNotes,
                    tenantInfo,
                    paymentStatus,
                    paymentSessionId
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
                    bookingStatus: { $in: ['pending', 'confirmed', 'approved'] }
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
                    ownerId: property.owner?.id || property.ownerId || 'unknown',
                    propertyInfo: {
                        title: property.title || 'Untitled',
                        price: property.price || 0,
                        location: property.location || 'N/A',
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
                    bookingStatus: 'pending',
                    paymentStatus: paymentStatus || 'pending',
                    paymentSessionId: paymentSessionId || null,
                    rejectionReason: null,
                    rejectedAt: null,
                    approvedAt: null,
                    cancelledAt: null,
                    paymentDate: paymentStatus === 'paid' ? new Date() : null,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                const result = await bookingsCollection.insertOne(booking);

                console.log('✅ Booking created with ID:', result.insertedId);

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

        // ✅ PATCH - Update payment status ONLY (NO booking status change)
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

                const updateData = {
                    paymentStatus: paymentStatus || 'paid',
                    paymentSessionId: sessionId || null,
                    updatedAt: new Date()
                };

                if (paymentStatus === 'paid') {
                    updateData.paymentDate = new Date();
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
                    message: 'Payment status updated successfully',
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

        // ✅ PATCH - Update booking status (Approve/Reject)
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

        // ✅ GET - All bookings (Tenant, Owner, or Admin)
        app.get('/api/bookings', async (req, res) => {
            try {
                const {
                    tenantId,
                    page = 1,
                    limit = 10,
                    status,
                    search,
                    isAdmin,
                    ownerId
                } = req.query;

                const skip = (parseInt(page) - 1) * parseInt(limit);
                const limitNum = parseInt(limit);

                // Build query
                let query = {};

                // ✅ Main Logic
                if (isAdmin === 'true') {
                    // Admin: সব booking দেখাবে
                    if (status && status !== 'all' && status !== 'undefined') {
                        query.bookingStatus = status;
                    }
                } else if (tenantId) {
                    // Tenant: শুধু নিজের booking
                    query.tenantId = tenantId;
                    if (status && status !== 'all' && status !== 'undefined') {
                        query.bookingStatus = status;
                    }
                } else if (ownerId) {
                    // Owner: নিজের property এর booking
                    query.ownerId = ownerId;
                    if (status && status !== 'all' && status !== 'undefined') {
                        query.bookingStatus = status;
                    }
                } else {
                    return res.status(400).json({
                        success: false,
                        message: 'tenantId, ownerId, or isAdmin is required'
                    });
                }

                // Search filter
                if (search) {
                    query.$or = [
                        { 'propertyInfo.title': { $regex: search, $options: 'i' } },
                        { 'tenantInfo.name': { $regex: search, $options: 'i' } },
                        { 'tenantInfo.email': { $regex: search, $options: 'i' } },
                        { 'propertyInfo.location': { $regex: search, $options: 'i' } }
                    ];
                }

                console.log('📊 Bookings Query:', JSON.stringify(query));

                // Get bookings
                const bookings = await bookingsCollection
                    .find(query)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limitNum)
                    .toArray();

                // Count total
                const totalCount = await bookingsCollection.countDocuments(query);

                // Get property details for each booking (optional)
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
                    totalItems: totalCount,
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / limitNum) || 1,
                    itemsPerPage: limitNum
                });

            } catch (error) {
                console.error('❌ Error fetching bookings:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch bookings',
                    error: error.message
                });
            }
        });

        // ✅ GET - Get bookings for owner (legacy support)
        app.get('/api/bookings/owner/:ownerId', async (req, res) => {
            try {
                const { ownerId } = req.params;
                const { status, search, page = 1, limit = 10 } = req.query;

                const query = { ownerId: ownerId };
                if (status && status !== 'all' && status !== 'undefined') {
                    query.bookingStatus = status;
                }

                if (search) {
                    query.$or = [
                        { 'propertyInfo.title': { $regex: search, $options: 'i' } },
                        { 'tenantInfo.name': { $regex: search, $options: 'i' } },
                        { 'propertyInfo.location': { $regex: search, $options: 'i' } }
                    ];
                }

                const skip = (parseInt(page) - 1) * parseInt(limit);
                const limitNum = parseInt(limit);
                const totalCount = await bookingsCollection.countDocuments(query);

                const bookings = await bookingsCollection
                    .find(query)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limitNum)
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
                    count: bookingsWithDetails.length,
                    pagination: {
                        currentPage: parseInt(page),
                        totalPages: Math.ceil(totalCount / limitNum),
                        totalItems: totalCount,
                        itemsPerPage: parseInt(limit)
                    }
                });

            } catch (error) {
                console.error('Error fetching owner bookings:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch bookings'
                });
            }
        });

        // ✅ GET - Get all bookings for a tenant (legacy support)
        app.get('/api/bookings/my-bookings', async (req, res) => {
            try {
                const { tenantId, page = 1, limit = 10, status, search } = req.query;

                if (!tenantId) {
                    return res.status(400).json({
                        success: false,
                        message: 'tenantId is required'
                    });
                }

                const skip = (parseInt(page) - 1) * parseInt(limit);
                const query = { tenantId: tenantId };

                if (status && status !== 'all' && status !== 'undefined') {
                    query.bookingStatus = status;
                }

                if (search) {
                    query.$or = [
                        { 'propertyInfo.title': { $regex: search, $options: 'i' } },
                        { 'propertyInfo.location': { $regex: search, $options: 'i' } }
                    ];
                }

                const totalCount = await bookingsCollection.countDocuments(query);
                const bookings = await bookingsCollection
                    .find(query)
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

        // ✅ GET - Single booking details
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

        // ✅ DELETE - Cancel booking (soft delete)
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
        // ==================== REVIEWS APIS ===========================
        // ============================================================

        // ✅ POST - Create a review
        app.post('/api/reviews', async (req, res) => {
            try {
                const { propertyId, tenantId, tenantName, tenantEmail, rating, comment } = req.body;

                console.log('📥 Review Request:', { propertyId, tenantId, rating, comment });

                if (!propertyId || !tenantId || !rating || !comment) {
                    return res.status(400).json({
                        success: false,
                        message: 'Property ID, Tenant ID, rating and comment are required'
                    });
                }

                if (rating < 1 || rating > 5) {
                    return res.status(400).json({
                        success: false,
                        message: 'Rating must be between 1 and 5'
                    });
                }

                // ✅ Check if user has booked this property
                const booking = await bookingsCollection.findOne({
                    propertyId: propertyId,
                    tenantId: tenantId,
                    bookingStatus: { $in: ['confirmed', 'approved', 'completed'] }
                });

                if (!booking) {
                    return res.status(403).json({
                        success: false,
                        message: 'You can only review properties you have booked'
                    });
                }

                // ✅ Check if user already reviewed this property
                const existingReview = await reviewsCollection.findOne({
                    propertyId: propertyId,
                    tenantId: tenantId
                });

                if (existingReview) {
                    return res.status(400).json({
                        success: false,
                        message: 'You have already reviewed this property'
                    });
                }

                // ✅ Get property details
                const property = await propertiesCollection.findOne({
                    _id: new ObjectId(propertyId)
                });

                // ✅ Get user details (for photo)
                const user = await usersCollection.findOne({
                    _id: new ObjectId(tenantId)
                });

                const review = {
                    propertyId: propertyId,
                    tenantId: tenantId,
                    tenantName: tenantName || user?.name || 'Anonymous',
                    tenantEmail: tenantEmail || user?.email || '',
                    tenantPhoto: user?.image || user?.photo || null,
                    rating: parseInt(rating),
                    comment: comment,
                    propertyTitle: property?.title || 'Property',
                    propertyImage: property?.images?.[0] || null,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                const result = await reviewsCollection.insertOne(review);

                console.log('✅ Review created:', result.insertedId);

                res.status(201).json({
                    success: true,
                    message: 'Review added successfully',
                    review: {
                        ...review,
                        _id: result.insertedId
                    }
                });

            } catch (error) {
                console.error('❌ Error creating review:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to create review',
                    error: error.message
                });
            }
        });

        // ✅ GET - All reviews for a property
        app.get('/api/reviews/:propertyId', async (req, res) => {
            try {
                const { propertyId } = req.params;
                const { limit = 10 } = req.query;

                const reviews = await reviewsCollection
                    .find({ propertyId: propertyId })
                    .sort({ createdAt: -1 })
                    .limit(parseInt(limit))
                    .toArray();

                const totalReviews = reviews.length;
                const averageRating = totalReviews > 0
                    ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
                    : 0;

                res.json({
                    success: true,
                    reviews: reviews,
                    totalReviews: totalReviews,
                    averageRating: averageRating.toFixed(1)
                });

            } catch (error) {
                console.error('❌ Error fetching reviews:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch reviews',
                    error: error.message
                });
            }
        });

        // ✅ GET - All reviews (for Home Page)
        app.get('/api/reviews', async (req, res) => {
            try {
                const { limit = 4 } = req.query;

                const reviews = await reviewsCollection
                    .find({})
                    .sort({ createdAt: -1 })
                    .limit(parseInt(limit))
                    .toArray();

                res.json({
                    success: true,
                    reviews: reviews,
                    count: reviews.length
                });

            } catch (error) {
                console.error('❌ Error fetching all reviews:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch reviews',
                    error: error.message
                });
            }
        });

        // ✅ GET - Check if user can review
        app.get('/api/reviews/check/:propertyId/:tenantId', async (req, res) => {
            try {
                const { propertyId, tenantId } = req.params;

                const booking = await bookingsCollection.findOne({
                    propertyId: propertyId,
                    tenantId: tenantId,
                    bookingStatus: { $in: ['confirmed', 'approved', 'completed'] }
                });

                if (!booking) {
                    return res.json({
                        success: true,
                        canReview: false,
                        message: 'You need to book this property first'
                    });
                }

                const existingReview = await reviewsCollection.findOne({
                    propertyId: propertyId,
                    tenantId: tenantId
                });

                res.json({
                    success: true,
                    canReview: !existingReview,
                    alreadyReviewed: !!existingReview,
                    message: existingReview ? 'You already reviewed this property' : 'You can review this property'
                });

            } catch (error) {
                console.error('❌ Error checking review:', error);
                res.json({
                    success: false,
                    canReview: false,
                    message: 'Error checking review status'
                });
            }
        });

        // ============================================================
        // ==================== STRIPE CHECKOUT SESSION ================
        // ============================================================

        // ✅ POST - Create Stripe Checkout Session
        app.post('/api/create-checkout-session', async (req, res) => {
            try {
                const { propertyId, propertyTitle, propertyPrice, bookingId } = req.body;

                console.log('📤 Creating Stripe session:', { propertyId, propertyTitle, propertyPrice, bookingId });

                if (!propertyId || !propertyTitle || !propertyPrice || !bookingId) {
                    return res.status(400).json({
                        success: false,
                        message: 'Missing required fields'
                    });
                }

                const session = await stripe.checkout.sessions.create({
                    payment_method_types: ['card'],
                    line_items: [
                        {
                            price_data: {
                                currency: 'usd',
                                product_data: {
                                    name: propertyTitle,
                                    description: `Booking payment for ${propertyTitle}`,
                                    metadata: {
                                        propertyId: propertyId,
                                        bookingId: bookingId
                                    }
                                },
                                unit_amount: Math.round(Number(propertyPrice) * 100)
                            },
                            quantity: 1
                        }
                    ],
                    mode: 'payment',
                    success_url: `${process.env.NEXT_PUBLIC_FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}&bookingId=${bookingId}`,
                    cancel_url: `${process.env.NEXT_PUBLIC_FRONTEND_URL}/payment/cancelled?bookingId=${bookingId}`,
                    metadata: {
                        propertyId: propertyId,
                        bookingId: bookingId,
                        amount: String(propertyPrice)
                    }
                });

                console.log('✅ Stripe session created:', session.id);

                res.json({
                    success: true,
                    sessionId: session.id,
                    url: session.url
                });

            } catch (error) {
                console.error('❌ Stripe error:', error);
                res.status(500).json({
                    success: false,
                    message: error.message || 'Failed to create payment session'
                });
            }
        });

        // ============================================================
        // ==================== DASHBOARD STATS ========================
        // ============================================================

        // ✅ GET - Admin dashboard stats (আপডেটেড - Revenue সহ)
        app.get('/api/admin/stats', async (req, res) => {
            try {
                const totalUsers = await usersCollection.countDocuments();
                const totalProperties = await propertiesCollection.countDocuments();
                const pendingProperties = await propertiesCollection.countDocuments({ status: 'pending' });
                const totalBookings = await bookingsCollection.countDocuments();
                const confirmedBookings = await bookingsCollection.countDocuments({ bookingStatus: 'confirmed' });

                // ✅ Calculate total revenue from paid bookings
                const revenueResult = await bookingsCollection.aggregate([
                    {
                        $match: {
                            paymentStatus: 'paid',
                            paymentDate: { $exists: true }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            totalRevenue: { $sum: '$propertyInfo.price' }
                        }
                    }
                ]).toArray();

                const totalRevenue = revenueResult[0]?.totalRevenue || 0;

                // ✅ Calculate monthly growth
                const now = new Date();
                const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

                const currentMonthRevenue = await bookingsCollection.aggregate([
                    {
                        $match: {
                            paymentStatus: 'paid',
                            paymentDate: { $gte: currentMonthStart, $lte: now }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: '$propertyInfo.price' }
                        }
                    }
                ]).toArray();

                const lastMonthRevenue = await bookingsCollection.aggregate([
                    {
                        $match: {
                            paymentStatus: 'paid',
                            paymentDate: { $gte: lastMonthStart, $lte: lastMonthEnd }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: '$propertyInfo.price' }
                        }
                    }
                ]).toArray();

                const currentMonth = currentMonthRevenue[0]?.total || 0;
                const lastMonth = lastMonthRevenue[0]?.total || 0;

                let monthlyGrowth = 0;
                if (lastMonth > 0) {
                    monthlyGrowth = Math.round(((currentMonth - lastMonth) / lastMonth) * 100);
                } else if (currentMonth > 0) {
                    monthlyGrowth = 100;
                }

                res.json({
                    success: true,
                    stats: {
                        totalUsers,
                        totalProperties,
                        pendingProperties,
                        totalBookings,
                        confirmedBookings,
                        totalRevenue,      // ✅ এখন revenue আসবে
                        monthlyGrowth      // ✅ monthly growth
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

        // ✅ GET - Owner dashboard stats with monthly earnings
        app.get('/api/owner/stats/:ownerId', async (req, res) => {
            try {
                const { ownerId } = req.params;

                const totalProperties = await propertiesCollection.countDocuments({
                    $or: [
                        { 'ownerId': ownerId },
                        { 'owner.id': ownerId }
                    ]
                });

                const totalBookings = await bookingsCollection.countDocuments({
                    ownerId: ownerId
                });

                const confirmedBookings = await bookingsCollection.countDocuments({
                    ownerId: ownerId,
                    bookingStatus: 'confirmed'
                });

                const monthlyEarnings = await getMonthlyEarnings(ownerId);
                const totalEarnings = monthlyEarnings.reduce((sum, item) => sum + item.earnings, 0);
                const pendingBookings = await bookingsCollection.countDocuments({
                    ownerId: ownerId,
                    bookingStatus: 'pending'
                });

                // ✅ Recent bookings
                const recentBookings = await bookingsCollection
                    .find({ ownerId: ownerId })
                    .sort({ createdAt: -1 })
                    .limit(5)
                    .toArray();

                res.json({
                    success: true,
                    stats: {
                        totalProperties,
                        totalBookings,
                        confirmedBookings,
                        pendingBookings,
                        totalEarnings,
                        monthlyEarnings,
                        recentBookings
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

        // ✅ Helper function - Get monthly earnings
        async function getMonthlyEarnings(ownerId) {
            const months = [];
            const now = new Date();

            for (let i = 11; i >= 0; i--) {
                const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const monthName = date.toLocaleString('default', { month: 'short' });
                const year = date.getFullYear();
                months.push({
                    month: monthName,
                    year: year,
                    startDate: new Date(date.getFullYear(), date.getMonth(), 1),
                    endDate: new Date(date.getFullYear(), date.getMonth() + 1, 0),
                    earnings: 0
                });
            }

            const bookings = await bookingsCollection.find({
                ownerId: ownerId,
                bookingStatus: { $in: ['confirmed', 'approved', 'pending'] },
                paymentStatus: 'paid',
                paymentDate: { $exists: true }
            }).toArray();

            bookings.forEach(booking => {
                if (!booking.paymentDate) return;

                const paymentDate = new Date(booking.paymentDate);
                const monthKey = paymentDate.toLocaleString('default', { month: 'short' });
                const yearKey = paymentDate.getFullYear();

                months.forEach(month => {
                    if (month.month === monthKey && month.year === yearKey) {
                        month.earnings += booking.propertyInfo?.price || 0;
                    }
                });
            });

            return months;
        }

        // ============================================================
        // ==================== TRANSACTIONS APIS ======================
        // ============================================================

        // ✅ GET - All transactions (Admin only)
        app.get('/api/admin/transactions', async (req, res) => {
            try {
                const { page = 1, limit = 10, status, search } = req.query;

                const skip = (parseInt(page) - 1) * parseInt(limit);
                const limitNum = parseInt(limit);

                let query = {};

                if (status && status !== 'all' && status !== 'undefined') {
                    query.paymentStatus = status;
                }

                if (search) {
                    query.$or = [
                        { 'propertyInfo.title': { $regex: search, $options: 'i' } },
                        { 'tenantInfo.name': { $regex: search, $options: 'i' } },
                        { 'tenantInfo.email': { $regex: search, $options: 'i' } },
                        { '_id': { $regex: search, $options: 'i' } }
                    ];
                }

                const transactions = await bookingsCollection
                    .find({
                        ...query,
                        paymentStatus: 'paid'
                    })
                    .sort({ paymentDate: -1, createdAt: -1 })
                    .skip(skip)
                    .limit(limitNum)
                    .toArray();

                const totalCount = await bookingsCollection.countDocuments({
                    ...query,
                    paymentStatus: 'paid'
                });

                const formattedTransactions = await Promise.all(transactions.map(async (booking) => {
                    let ownerName = 'N/A';

                    if (booking.ownerName) {
                        ownerName = booking.ownerName;
                    } else if (booking.ownerId) {
                        try {
                            const owner = await usersCollection.findOne({
                                _id: new ObjectId(booking.ownerId)
                            });
                            if (owner) {
                                ownerName = owner.name || 'N/A';
                            }
                        } catch (err) {
                            console.error('Error fetching owner:', err);
                        }
                    }

                    return {
                        _id: booking._id,
                        transactionId: booking._id,
                        propertyInfo: booking.propertyInfo || {
                            title: 'N/A',
                            location: 'N/A',
                            price: 0
                        },
                        tenantInfo: booking.tenantInfo || {
                            name: 'Unknown',
                            email: 'N/A',
                            phone: 'N/A'
                        },
                        ownerInfo: {
                            name: ownerName,
                            id: booking.ownerId || 'N/A'
                        },
                        ownerName: ownerName,
                        amount: booking.propertyInfo?.price || 0,
                        status: booking.paymentStatus || 'paid',
                        paymentType: 'booking',
                        paymentMethod: 'stripe',
                        paymentSessionId: booking.paymentSessionId || null,
                        paymentDate: booking.paymentDate || booking.createdAt,
                        createdAt: booking.createdAt,
                        updatedAt: booking.updatedAt,
                        additionalNotes: booking.additionalNotes || null,
                        bookingStatus: booking.bookingStatus || 'pending'
                    };
                }));

                res.json({
                    success: true,
                    transactions: formattedTransactions,
                    totalItems: totalCount,
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / limitNum),
                    itemsPerPage: limitNum
                });

            } catch (error) {
                console.error('❌ Error fetching transactions:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch transactions',
                    error: error.message
                });
            }
        });

        // ✅ GET - Single transaction details (Admin only)
        app.get('/api/admin/transactions/:id', async (req, res) => {
            try {
                const { id } = req.params;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid transaction ID'
                    });
                }

                const booking = await bookingsCollection.findOne({
                    _id: new ObjectId(id),
                    paymentStatus: 'paid'
                });

                if (!booking) {
                    return res.status(404).json({
                        success: false,
                        message: 'Transaction not found'
                    });
                }

                const transaction = {
                    _id: booking._id,
                    transactionId: booking._id,
                    propertyInfo: booking.propertyInfo || {
                        title: 'N/A',
                        location: 'N/A',
                        price: 0
                    },
                    tenantInfo: booking.tenantInfo || {
                        name: 'Unknown',
                        email: 'N/A',
                        phone: 'N/A'
                    },
                    amount: booking.propertyInfo?.price || 0,
                    status: booking.paymentStatus || 'paid',
                    paymentType: 'booking',
                    paymentMethod: 'stripe',
                    paymentSessionId: booking.paymentSessionId || null,
                    paymentDate: booking.paymentDate || booking.createdAt,
                    createdAt: booking.createdAt,
                    updatedAt: booking.updatedAt,
                    additionalNotes: booking.additionalNotes || null,
                    bookingStatus: booking.bookingStatus || 'pending'
                };

                res.json({
                    success: true,
                    transaction: transaction
                });

            } catch (error) {
                console.error('❌ Error fetching transaction:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch transaction',
                    error: error.message
                });
            }
        });

        // ✅ GET - Transaction stats (Admin only)
        app.get('/api/admin/transactions/stats', async (req, res) => {
            try {
                const totalTransactions = await bookingsCollection.countDocuments({
                    paymentStatus: 'paid'
                });

                const revenueResult = await bookingsCollection.aggregate([
                    { $match: { paymentStatus: 'paid' } },
                    { $group: { _id: null, total: { $sum: '$propertyInfo.price' } } }
                ]).toArray();
                const totalRevenue = revenueResult[0]?.total || 0;

                const successful = await bookingsCollection.countDocuments({
                    paymentStatus: 'paid'
                });

                const pending = await bookingsCollection.countDocuments({
                    paymentStatus: 'pending'
                });

                const failed = await bookingsCollection.countDocuments({
                    paymentStatus: 'failed'
                });

                res.json({
                    success: true,
                    stats: {
                        totalTransactions,
                        totalRevenue,
                        successful,
                        pending,
                        failed
                    }
                });

            } catch (error) {
                console.error('❌ Error fetching transaction stats:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to fetch transaction stats',
                    error: error.message
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