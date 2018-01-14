const fs = require('fs');
const path = require('path');

module.exports = (filename) => {

    let file = path.resolve( __dirname, './' ) + '/' + filename + '.json';
    let data;

    try {
        data = JSON.parse(fs.readFileSync(file));
    } catch(e) {}

    return {

        get() {
            return data;
        },

        getMaxId() {
            return Math.max( ...data.map( item => {
                return item.id;
            } ) );
        },

		save(newData) {
        	if (newData) {
        		data = newData;
			}
			fs.writeFileSync(file, JSON.stringify(data));
		}

    };

};