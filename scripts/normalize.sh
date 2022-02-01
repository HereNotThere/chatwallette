ffmpeg -i $1 -af "adelay=10000|10000" $1.enlarged.wav
ffmpeg-normalize  $1.enlarged.wav -ofmt wav -ext wav
ffmpeg -i normalized/$1.enlarged.wav -ss 00:00:10.000 -acodec copy $1.normalized.wav
mv $1 orig
mv $1.normalized.wav $1
rm normalized/$1.enlarged.wav
rm $1.enlarged.wav