const pool = require('../config/db');
const cloudinary = require('../config/cloudinary');

async function deleteOldSubmissions() {
  console.log('Running daily cleanup job: Deleting submissions older than 24 hours...');
  const connection = await pool.getConnection();
  try {
    // 1. Find all submissions older than 24 hours
    const [oldSubmissions] = await connection.query(
      "SELECT id, photo_url FROM submissions WHERE submitted_at < NOW() - INTERVAL 24 HOUR"
    );

    if (oldSubmissions.length === 0) {
      console.log('Cleanup job finished: No old submissions found.');
      return;
    }

    const submissionIdsToDelete = [];
    
    // 2. Loop through them and delete each photo from Cloudinary
    for (const submission of oldSubmissions) {
      try {
        // Extract the public_id from the Cloudinary URL
        const parts = submission.photo_url.split('/');
        const publicIdWithExt = parts.slice(parts.indexOf('sheet-solver-proofs')).join('/');
        const publicId = publicIdWithExt.substring(0, publicIdWithExt.lastIndexOf('.'));

        await cloudinary.uploader.destroy(publicId);
        console.log(`Deleted from Cloudinary: ${publicId}`);
        submissionIdsToDelete.push(submission.id);
      } catch (cloudinaryError) {
        console.error(`Failed to delete ${submission.photo_url} from Cloudinary:`, cloudinaryError);
      }
    }

    // 3. Delete the corresponding records from our database in one go
    if (submissionIdsToDelete.length > 0) {
    // We update the existing records, setting photo_url to NULL
    await connection.query(
        'UPDATE submissions SET photo_url = NULL WHERE id IN (?)', 
        [submissionIdsToDelete]
    );
    console.log(`Updated ${submissionIdsToDelete.length} records: Removed photo_url.`);
}

console.log('Cleanup job finished successfully.');

  } catch (error) {
    console.error('An error occurred during the cleanup job:', error);
  } finally {
    connection.release();
  }
}

module.exports = { deleteOldSubmissions };