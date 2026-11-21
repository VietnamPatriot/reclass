CREATE TABLE profiles (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  school TEXT NOT NULL,
  shop TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  verified INTEGER NOT NULL DEFAULT 0 CHECK(verified IN (0,1)),
  moderator INTEGER NOT NULL DEFAULT 0 CHECK(moderator IN (0,1))
);
--> statement-breakpoint
CREATE TABLE invites (
  hash TEXT PRIMARY KEY NOT NULL,
  school TEXT NOT NULL,
  expires TEXT NOT NULL,
  used_by TEXT REFERENCES profiles(id)
);
--> statement-breakpoint
CREATE TABLE listings (
  id TEXT PRIMARY KEY NOT NULL,
  seller_id TEXT NOT NULL REFERENCES profiles(id),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  condition TEXT NOT NULL,
  price INTEGER NOT NULL CHECK(price >= 0),
  negotiable INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  delivery TEXT NOT NULL,
  images TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','hidden','rejected','sold')),
  reason TEXT NOT NULL DEFAULT '',
  created TEXT NOT NULL DEFAULT (datetime('now')),
  updated TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX listings_seller ON listings(seller_id, status);
--> statement-breakpoint
CREATE INDEX listings_status ON listings(status, created);
--> statement-breakpoint
CREATE TABLE trades (
  id TEXT PRIMARY KEY NOT NULL,
  listing_id TEXT NOT NULL REFERENCES listings(id),
  buyer_id TEXT NOT NULL REFERENCES profiles(id),
  seller_id TEXT NOT NULL REFERENCES profiles(id),
  buyer_done INTEGER NOT NULL DEFAULT 0,
  seller_done INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','completed','cancelled')),
  created TEXT NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX trades_open_buyer ON trades(listing_id, buyer_id) WHERE status = 'open';
--> statement-breakpoint
CREATE UNIQUE INDEX trades_completed_item ON trades(listing_id) WHERE status = 'completed';
--> statement-breakpoint
CREATE TABLE messages (
  id TEXT PRIMARY KEY NOT NULL,
  trade_id TEXT NOT NULL REFERENCES trades(id),
  sender_id TEXT NOT NULL REFERENCES profiles(id),
  body TEXT NOT NULL,
  created TEXT NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX messages_trade ON messages(trade_id, created);
--> statement-breakpoint
CREATE TABLE reviews (
  id TEXT PRIMARY KEY NOT NULL,
  trade_id TEXT NOT NULL UNIQUE REFERENCES trades(id),
  seller_id TEXT NOT NULL REFERENCES profiles(id),
  author_id TEXT NOT NULL REFERENCES profiles(id),
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  text TEXT NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0,
  created TEXT NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX reviews_seller ON reviews(seller_id, hidden, created);
--> statement-breakpoint
CREATE TABLE reports (
  id TEXT PRIMARY KEY NOT NULL,
  reporter_id TEXT NOT NULL REFERENCES profiles(id),
  kind TEXT NOT NULL CHECK(kind IN ('site','listing','review','trade','appeal')),
  target TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),
  created TEXT NOT NULL DEFAULT (datetime('now'))
);
