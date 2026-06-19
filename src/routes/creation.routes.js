const express = require('express')
const authMiddleware = require("../middlewares/auth.middleware")
const router = express.Router()
const { programs } = require("../controllers/acadmicgroups/program.controller")
const { schools } = require("../controllers/acadmicgroups/school.controller")
const {Specialization} = require("../controllers/acadmicgroups/specialization.controller")
const {subjects} = require("../controllers/acadmicgroups/subject.controller")
const {createSemester} = require("../controllers/acadmicgroups/semester.controller")
const multer = require('multer');

const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    }
});
router.post('/programs', authMiddleware.chkUser, programs)
router.post(
  "/school",
  authMiddleware.chkUser,
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "banner", maxCount: 1 }
  ]),
  schools
);

router.post("/specialization",authMiddleware.chkUser,Specialization)
router.post('/subject',authMiddleware.chkUser,subjects)
router.post("/semester",authMiddleware.chkUser,createSemester)
module.exports = router