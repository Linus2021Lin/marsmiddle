BRANCH='main'

echo "==> 1. Download mars middle web code."
rm -rf marsmiddle_web
git clone --branch $BRANCH https://github.com/Linus2021Lin/marsmiddle_web
if [ $? -ne 0 ]; then
 echo '==== Download Fail ===='
 exit $?
fi
echo ''

echo "==> 2. Start to build mars web code."
cd marsmiddle_web
docker run --rm -v "$PWD":/home/node/web  -w /home/node/web node:16-slim sh -c "npm install --force && npm run build --prod"
if [ $? -ne 0 ]; then
 echo '==== Build Fail ===='
 exit $?
fi
cd ..
echo ''

echo "==> 3. Replace the public folder"
shopt -s extglob
echo "==> 3.1 Remove web files in public folder"
rm -rf public/!(.gitignore)
#echo "==> 3.2 Copy web files"
cp -Rf marsmiddle_web/dist/public .
