#!/usr/bin/env python3
# Merge per-shard overlay DBs (each with a `features` table) into one store and
# build the indexes once. Usage: merge_shards.py OUT.db shard1.db shard2.db ...
import os, sys, sqlite3

out = sys.argv[1]
shards = [s for s in sys.argv[2:] if os.path.exists(s)]
tmp = out + ".tmp"
for p in (out, tmp):
    for suf in ("", "-wal", "-shm"):
        try:
            os.remove(p + suf)
        except OSError:
            pass

con = sqlite3.connect(tmp, isolation_level=None)  # autocommit
con.executescript("""
CREATE TABLE features(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  osm_type TEXT, osm_id INTEGER,
  name TEXT, category TEXT, subcat TEXT,
  lat REAL, lon REAL, tags TEXT
);
""")

merged = 0
for s in shards:
    c = con.cursor()
    try:
        c.execute("ATTACH DATABASE ? AS sh", (s,))
        c.execute(
            "INSERT INTO features(osm_type,osm_id,name,category,subcat,lat,lon,tags) "
            "SELECT osm_type,osm_id,name,category,subcat,lat,lon,tags FROM sh.features")
        c.fetchall()  # fully consume -> release the read lock
        merged += 1
        print(f"merged {s}")
    except sqlite3.Error as e:
        print(f"merge: {s}: {e}", file=sys.stderr)
    finally:
        try:
            c.execute("DETACH DATABASE sh")
        except sqlite3.Error:
            pass  # data is already in; a stuck detach is harmless
        c.close()

con.executescript("""
CREATE INDEX idx_f_name ON features(name);
CREATE INDEX idx_f_cat  ON features(category);
CREATE INDEX idx_f_lat  ON features(lat);
CREATE INDEX idx_f_lon  ON features(lon);
""")
n = con.execute("SELECT COUNT(*) FROM features").fetchone()[0]
size = os.path.getsize(tmp)
con.close()
os.replace(tmp, out)
for suf in ("", "-wal", "-shm"):
    try:
        os.remove(tmp + suf)
    except OSError:
        pass
print(f"merge_shards: {merged} shards -> {out} ({n} features, {size} bytes)")
