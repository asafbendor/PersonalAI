-- Third round (10 November 2026): ambassador picks among versions, impressions for value estimate,
-- suggested network profile per ambassador.
ALTER TABLE posts ADD COLUMN alternatives_json TEXT; -- the other versions the ambassador may choose instead: ["...", "..."]
ALTER TABLE posts ADD COLUMN impressions INTEGER;
ALTER TABLE personas ADD COLUMN profile_kit_json TEXT; -- {headline, about, tips[]} suggested by AI, edited by the operator
