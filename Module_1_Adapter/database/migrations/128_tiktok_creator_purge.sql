-- 128: TikTok is removed from creators and rankings (no permitted public statistics source).
-- Removes creator-linked TikTok accounts and any stored authorizations. Revoke upstream first from
-- People > Disconnect (before deploying the update that removes that action), or in the TikTok app.
-- Schema objects from 127 are left in place (additive history); nothing reads or writes them.
DO $$ BEGIN
 IF to_regclass('tiktokingest.oauth_states') IS NOT NULL THEN DELETE FROM tiktokingest.oauth_states; END IF;
 IF to_regclass('tiktokingest.connections') IS NOT NULL THEN DELETE FROM tiktokingest.connections; END IF;
 DELETE FROM accounts WHERE platform='tiktok';
END $$;
