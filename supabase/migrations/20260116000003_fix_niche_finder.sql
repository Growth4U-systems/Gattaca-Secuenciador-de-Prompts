-- =====================================================
-- NICHE FINDER FIXES
-- RPC function for atomic counter updates
-- =====================================================

-- Function for atomic counter increments to avoid race conditions
CREATE OR REPLACE FUNCTION increment_niche_finder_counters(
  p_job_id UUID,
  p_urls_scraped INTEGER DEFAULT 0,
  p_urls_failed INTEGER DEFAULT 0,
  p_urls_filtered INTEGER DEFAULT 0,
  p_niches_extracted INTEGER DEFAULT 0
) RETURNS void AS $$
BEGIN
  UPDATE niche_finder_jobs SET
    urls_scraped = urls_scraped + COALESCE(p_urls_scraped, 0),
    urls_failed = urls_failed + COALESCE(p_urls_failed, 0),
    urls_filtered = urls_filtered + COALESCE(p_urls_filtered, 0),
    niches_extracted = niches_extracted + COALESCE(p_niches_extracted, 0)
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION increment_niche_finder_counters(UUID, INTEGER, INTEGER, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION increment_niche_finder_counters(UUID, INTEGER, INTEGER, INTEGER, INTEGER) TO authenticated;
