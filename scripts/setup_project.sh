#!/bin/bash
if [ -d _project_ ]; then
    mv _project_ $1
fi
if [ -d $1/_project_ ]; then
    mv $1/_project_ $1/$1
fi
find . -type f -not -name setup_project.sh | xargs grep -l _project_ | xargs -n 1 sed -i "" "s/_project_/$1/g"
