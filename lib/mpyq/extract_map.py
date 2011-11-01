#!/usr/bin/python
import sys
import os
import re
from mpyq import MPQArchive

def extract_map(mpq, thumbnail_name=None, outdir=None):
    """Extract a map's thumbnail image and language files"""
    archive_name, extension = os.path.splitext(mpq.file.name)
    if thumbnail_name is None:
        thumbnail_name = 'Minimap.tga'
    if outdir is None:
        outdir = archive_name + '-extracted'
    if not os.path.isdir(os.path.join(os.getcwd(), outdir)):
        os.mkdir(outdir)
    os.chdir(outdir)

    local_regex = re.compile(r'^[a-z][a-z][A-Z][A-Z]\.SC2Data\\LocalizedData\\GameStrings\.txt$')
    for filename in mpq.files:
        if filename == thumbnail_name:
            data = mpq.read_file(filename)
            f = open(filename, 'wb')
            f.write(data)
            f.close()
        elif local_regex.match(filename):
            data = mpq.read_file(filename)
            f = open(filename, 'wb')
            f.write(data)
            f.close()

if len(sys.argv) < 2:
    print 'syntax: extract_map.py <map> [thumbnail-name] [/output/dir/]'
    sys.exit(1)

mapdir = os.path.dirname(sys.argv[1])
if mapdir == "":
    mapdir = "."
os.chdir(mapdir)
archive = MPQArchive(sys.argv[1])
outdir = None
thumbnail_name = None
if len(sys.argv) >= 3:
    outdir = sys.argv[2]
if len(sys.argv) >= 4:
    outdir = sys.argv[3]
extract_map(archive, outdir)
