#!/bin/bash
for f in files/*.txt do
	awk '{print $1,"\t",$2,"\t",$3,"\t",$4,"\t",$5,"\t",$6,"\t",$7,"\t",$8}' $f > $f.csv
done
