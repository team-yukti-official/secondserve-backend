const errorHandler = (err, req, res, next) => {
    console.error(err);
    
    const status = err.status || 500;
    const message = err.message || 'Internal Server Error';
    
    res.status(status).json({
        error: message,
        details: process.env.NODE_ENV === 'development' ? err.details : undefined
    });
};

module.exports = errorHandler;
