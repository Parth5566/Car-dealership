ALTER TABLE nw_blog_posts ADD COLUMN scheduled_at DATETIME NULL;
CREATE TABLE IF NOT EXISTS nw_blog_media_refs (
  post_id BIGINT UNSIGNED NOT NULL,
  media_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (post_id,media_id),
  INDEX(media_id),
  FOREIGN KEY(post_id) REFERENCES nw_blog_posts(id) ON DELETE CASCADE,
  FOREIGN KEY(media_id) REFERENCES nw_blog_media(id) ON DELETE CASCADE
) ENGINE=InnoDB;
