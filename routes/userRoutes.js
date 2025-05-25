const express = require('express');
const router = express.Router();
const {
  createScrapedData,
  getScrapedDatas,
  createFilteredData,
  createAdmin,
  createWorker,
  signIn,
  getCityCases,
  getDistrictData,
  createVolunteerData,
  getVolunteerDatas,
  getDistrictCasesByCity,
  markScrapedDataAsUsed,
  deleteFilteredData,
  createHashtag,
  getAllHashtags,
  updateHashtag,
  deleteHashtag

} = require('../controllers/userController');
const { authenticate, restrictToAdmin } = require('../middleware/middleware');

router.post('/scraped-datas', createScrapedData);
router.get('/scraped-datas', getScrapedDatas);
router.post('/filtered-datas', createFilteredData);
router.post('/create-admin', authenticate, createAdmin);
router.post('/create-worker', authenticate, restrictToAdmin, createWorker);
router.post('/sign-in', signIn);
router.get('/filtered-datas/cities', authenticate, getCityCases);
router.get('/filtered-datas/district-cases/:il', authenticate, getDistrictCasesByCity);
router.get('/filtered-datas/district/', authenticate, getDistrictData);
router.post('/volunteer-datas', createVolunteerData);
router.get('/volunteer-datas',authenticate, getVolunteerDatas);
router.post('/scraped-datas/mark-used', markScrapedDataAsUsed);
router.delete('/filtered-datas/:id', authenticate, deleteFilteredData);
router.post('/hashtags', createHashtag);
router.get('/hashtags', getAllHashtags);
router.put('/hashtags/:id', updateHashtag);
router.delete('/hashtags/:id',deleteHashtag);

module.exports = router;