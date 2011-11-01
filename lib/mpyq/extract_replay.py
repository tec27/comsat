#!/usr/bin/python
import sys
import os
from mpyq import MPQArchive

def extract_to_disk(mpq, outdir=None):
    """Extract all files and write them to disk."""
    archive_name, extension = os.path.splitext(mpq.file.name)
    if outdir is None:
        outdir = archive_name + '-extracted'
    if not os.path.isdir(os.path.join(os.getcwd(), outdir)):
        os.mkdir(outdir)
    os.chdir(outdir)
    if mpq.header['user_data_header']:
        f = open('replay.header', 'wb')
        f.write(mpq.header['user_data_header']['content'])
        f.close()
    for filename, data in mpq.extract().items():
        f = open(filename, 'wb')
        f.write(data)
        f.close()

if len(sys.argv) < 2:
    print 'syntax: extract_replay.py <replay> [/output/dir/]'
    sys.exit(1)

repdir = os.path.dirname(sys.argv[1])
if repdir == "":
    repdir = "."
os.chdir(repdir)
archive = MPQArchive(sys.argv[1])
outdir = None
if len(sys.argv) >= 3:
    outdir = sys.argv[2]
extract_to_disk(archive, outdir)
