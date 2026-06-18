const jwt = require('jsonwebtoken');
require('dotenv').config();
const chkUser = async (req,res,next) =>{
    try{
        const token = req.cookies.access_token;
        

        if(!token){
            return res.status(401).json({message:"Unauthorized"});
        }

        const decoded = await jwt.verify(token, process.env.JWT_SECRET);
        
        if(!decoded){
            return res.status(401).json({message:"Unauthorized"});
        }

        req.user = decoded;

        next();
    }
    catch(err){
        console.error(err.message);
        return res.status(500).json({message:"Internal Server Error",error:err.message});
    }
}





module.exports = {chkUser};