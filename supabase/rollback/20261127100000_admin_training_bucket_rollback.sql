-- Rollback for 20261127100000_admin_training_bucket.sql.
-- First remove the three files (Supabase dashboard → Storage → admin-training, or the storage
-- API with the service key: remove impact-lab-website-tour.mp4, impact-lab-admin-training.mp4,
-- impact-lab-admin-quick-start.pdf). Then delete the empty bucket:
delete from storage.buckets where id = 'admin-training';
