#!/bin/sh

[ -f aoi.xpi ] && rm aoi.xpi;
zip -r9 aoi.xpi chrome.manifest install.rdf chrome components -x \*.svn/* -x \*.DS_Store;
printf "build finished.\n";
