const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

const storage = require('./storage');

const server = express();
const host = '127.0.0.1';
const port = 9999;
const staticPath = '/public';
const url = `http://${host}:${port}`;
const staticUrl = url + staticPath + '/';
const attachmentUrl = url + staticPath + '/attachments/';

/*
* 处理静态文件
* */
server.use( staticPath, express.static('./public') );

/*
* 处理post提交的urlencode数据
* */
server.use( bodyParser.urlencoded({ extended: true }) );
server.use( bodyParser.json() );

/*
* 处理cookie
* */
server.use( cookieParser() );

server.use( (req, res, next) => {
    /*
    * @TODO 添加一些自己的中间件逻辑
    * */
    res.header('Access-Control-Allow-Origin', '*');
    next();
} );

/*
* 首页
* */
server.get( '/', (req, res) => {

    const maxAge = 3600 * 1000 * 24;
    res.cookie('uid', 1, { maxAge, httpOnly: true } );

    res.json({
        code: 0,
        message: '这是首页'
    });

} );

/*
* 用户登录
* @Method POST
* @Url /login
* @Data username 用户名
* @Data password 密码
* @Return {Object} 登录成功后的用户信息
* */
server.post('/login', (req, res) => {

    const username = req.body.username || '';
    const password = req.body.password || '';

    if (!username || !password) {
        res.json({
            code: 1,
            message: '缺少参数'
        });
        return;
    }

    const users = storage('user').get();

    const user = users.find( user => user.username == username && user.password == password);

    if (!user) {
        res.json({
            code: 2,
            message: '不存在该用户或者密码错误'
        });
		return;
    }

    // 设置登录用户cookie
    const maxAge = 3600 * 1000 * 24;
    res.cookie('uid', user.id, { maxAge, httpOnly: true } );

    res.json({
        uid: user.id,
        username: user.username
    });
});

/*
* 获取指定商品详情
* @Method GET
* @Url /item/:id
* @params id 要获取的商品ID
* @Return {Object} 商品详情信息
* */
server.get('/item/:id', (req, res) => {
    const id = req.params.id || null;

    if (!id) {
        res.json({
            code: 1,
            message: '缺少参数'
        });
		return;
    };

    const items = storage('item').get() || [];

    let data = items.find( item => item.id == id );

    if (!data) {
        res.json({
            code: 2,
            message: '不存在该商品信息'
        });
		return;
    }

    let parentInfo = items.find( item => item.id == data.pid );

    res.json({
        title: parentInfo.title,
        sub_title: parentInfo.sub_title,
        ...data
    });
});

/*
* 获取商品列表
* @Method GET
* @Url /item
* @Return [Array] 商品列表数组
* */
server.get('/item', (req, res) => {
    const items = storage('item').get() || [];

    res.json({
        data: items.map( item => {
            if (item.album) {
                item.album = item.album.map( album => {
                    return attachmentUrl + album;
                } )
            }
            return undefined === item.pid ? item : Object.assign( item, {
                color: attachmentUrl + item.color,
                cover: attachmentUrl + item.cover
            } );
        } )
    });
});

/*
* 获取当前登录用户的购物车信息
* @Method GET
* @Url /cart
* @params uid 当前用户id
* @Return [Array] 商品列表数组
* */
server.get('/cart', (req, res) => {
    const uid = req.cookies.uid || req.query.uid;

    if (!uid) {
        res.json({
            code: 1,
            message: '无权限访问'
        });
		return;
    }

    const carts = storage('cart').get();
	const items = storage('item').get();
    let data = carts.filter( cart => {
        return cart.uid == uid;
    } ).map( cart => {
        let item = items.find( item => {
			return item.id == cart.itemId
		} );
        cart.item = {
            id: item.id,
            pid: item.pid,
            name: item.name,
            price: item.price,
            color: attachmentUrl + item.color,
            cover: attachmentUrl + item.cover
        };
        let parentItem = items.find( item => {
			return item.id == cart.item.pid;
		} );
		cart.item.title = parentItem.title;
		cart.item.sub_title = parentItem.sub_title;

        return cart;
    } );
    res.json({data});
});

/*
 * 添加商品到购物车
 * @Method POST
 * @Url /cart/add
 * @params uid 用户id
 * @params item_id 要添加的商品id
 * @Return {Object}
 * */
server.post('/cart/add', ( req, res ) => {
    const uid = Number(req.cookies.uid || req.query.uid || req.body.uid);
    const item_id = Number(req.body.item_id);

    if (!uid) {
        res.json({
            code: 1,
            message: '无权限访问'
        });
		return;
    }

    if (!item_id) {
        res.json({
            code: 2,
            message: '请选择要添加到购物车的商品'
        });
		return;
    }

    const cartsStorage = storage('cart');

    let carts = cartsStorage.get();
    const myCart = carts.find( cart => {
        return cart.uid == uid && cart.itemId == item_id;
    } );

    if ( myCart ) {
		myCart.quantity++;
    } else {
		carts.push({
			id: cartsStorage.getMaxId() + 1,
			uid: uid,
			itemId: item_id,
			quantity: 1
		});
    }
	cartsStorage.save();

    res.json({
        code: 0,
        message: '添加成功'
    });
});

/*
 * 选中指定用户购物车中指定的商品
 * @Method POST
 * @Url /cart/toggle
 * @params uid 用户id
 * @params item_id 要选中的商品id
 * @Return {Object}
 * */

server.post('/cart/toggle', (req, res) => {
    const uid = Number(req.cookies.uid || req.query.uid || req.body.uid);
    // const item_id = Number(req.body.item_id);
    const cartId = Number(req.body.cart_id);

    if (!uid) {
        res.json({
            code: 1,
            message: '无权限访问'
        });
        return;
    }

    const cartsStorage = storage('cart');

    let carts = cartsStorage.get();
    const myCart = carts.find( cart => {
        return cart.uid == uid && cart.id == cartId;
    } );

    if (!myCart) {
        res.json({
            code: 3,
            message: '您的购物车中还没有添加该商品'
        });
        return;
    }

    myCart.checked = !myCart.checked;
    cartsStorage.save();

    res.json({
        code: 0,
        message: '操作成功'
    });
});

/*
 * 选中或取消指定用户购物车中的所有商品
 * @Method POST
 * @Url /cart/toggleAll
 * @params uid 用户id
 * @Return {Object}
 * */
server.post('/cart/toggleAll', (req, res) => {
    const uid = Number(req.cookies.uid || req.query.uid || req.body.uid);
    const checked = !!Number(req.body.checked);

    if (!uid) {
        res.json({
            code: 1,
            message: '无权限访问'
        });
        return;
    }

    const cartsStorage = storage('cart');

    let carts = cartsStorage.get();
    carts = carts.map( cart => {
        if (cart.uid == uid) {
            cart.checked = checked;
        }
    } );

    cartsStorage.save();

    res.json({
        code: 0,
        message: '操作成功'
    });
});

/*
 * 从购物车中减少指定商品数量
 * @Method POST
 * @Url /cart/remove
 * @params uid 用户id
 * @params item_id 要删除的商品id
 * @Return {Object}
 * */
server.post('/cart/remove', ( req, res ) => {
	const uid = Number(req.cookies.uid || req.query.uid || req.body.uid);
	const item_id = Number(req.body.item_id);


	if (!uid) {
		res.json({
			code: 1,
			message: '无权限访问'
		});
		return;
	}

	if (!item_id) {
        res.json({
            code: 2,
            message: '请选择要移除的商品'
        });
        return;
    }

	const cartsStorage = storage('cart');

	let carts = cartsStorage.get();
	const myCart = carts.find( cart => {
		return cart.uid == uid && cart.itemId == item_id;
	} );

	if (!myCart) {
	    res.json({
            code: 3,
            message: '您的购物车中还没有添加该商品'
        });
		return;
    }

    if (myCart.quantity > 1) {
		myCart.quantity--;
		cartsStorage.save();
    } else {
	    // @TODO 调用 /cart/clear 清空
        // carts = carts.filter( cart => {
        //    return cart != myCart;
        // } );
        // cartsStorage.save(carts);
        res.json({
            code: 4,
            message: '商品数量不能小于1'
        });
        return;
    }

	res.json({
		code: 0,
		message: '移除成功'
	});

});

/*
 * 从购物车中清空指定用户的指定商品
 * @Method POST
 * @Url /cart/clear
 * @params uid 用户id
 * @params id 要获取的商品ID
 * @Return {Object}
 * */
server.post('/cart/clear', (req, res) => {
    const uid = Number(req.cookies.uid || req.query.uid || req.body.uid);
    const item_id = Number(req.body.item_id);

	if (!uid) {
		res.json({
			code: 1,
			message: '无权限访问'
		});
		return
	}

	if (!item_id) {
		res.json({
			code: 2,
			message: '请选择要移除的商品'
		});
		return;
	}

	const cartsStorage = storage('cart');

	let carts = cartsStorage.get();

	carts = carts.filter( cart => cart.uid != uid || cart.itemId != item_id );

	cartsStorage.save(carts);

	res.json({
		code: 0,
		message: '移除成功'
	});
});

/*
 * 从购物车中清空指定用户的购物车所有选中的商品
 * @Method POST
 * @Url /cart/clearchecked
 * @params uid 用户id
 * @Return {Object}
 * */
server.post('/cart/clearchecked', (req, res) => {
    const uid = Number(req.cookies.uid || req.query.uid || req.body.uid);

    if (!uid) {
        res.json({
            code: 1,
            message: '无权限访问'
        });
        return;
    }

    const cartsStorage = storage('cart');

    let carts = cartsStorage.get();

    carts = carts.filter( cart => cart.uid != uid || !cart.checked );

    cartsStorage.save(carts);

    res.json({
        code: 0,
        message: '删除成功'
    });
});

/*
 * 从购物车中清空指定用户的购物车所有商品
 * @Method POST
 * @Url /cart/clearall
 * @params uid 用户id
 * @Return {Object}
 * */
server.post('/cart/clearall', (req, res) => {
    const uid = Number(req.cookies.uid || req.query.uid || req.body.uid);

	if (!uid) {
		res.json({
			code: 1,
			message: '无权限访问'
		});
		return;
	}

	const cartsStorage = storage('cart');

	let carts = cartsStorage.get();

	carts = carts.filter( cart => cart.uid != uid );

	cartsStorage.save(carts);

	res.json({
		code: 0,
		message: '清空成功'
	});
});


/*
 * 支付
 * @Method POST
 * @Url /payment
 * @params uid 用户id
 * @Return {Object}
 * @TODO 没有完成的功能 - 支付
 * */
server.post('/payment', (req, res) => {
    const uid = Number(req.cookies.uid || req.query.uid || req.body.uid);
});

/*
 * 我的订单
 * @Method GET
 * @Url /order
 * @params uid 用户id
 * @Return {Object}
 * */
server.get('/order', (req, res) => {
    const uid = Number(req.cookies.uid || req.query.uid);

	if (!uid) {
		res.json({
			code: 1,
			message: '无权限访问'
		});
		return;
	}

	const ordersStorage = storage('order');

	const orders = ordersStorage.get();

	const order = orders.filter( cart => cart.uid == uid );

	res.json({data: order});
});

/*
 * 我的地址
 * @Method GET
 * @Url /address
 * @params uid 用户id
 * @Return {Object}
 * */
server.get('/address', (req, res) => {
    const uid = Number(req.cookies.uid || req.query.uid);

    if (!uid) {
    	res.json({
			code: 1,
			message: '无权限访问'
		});
    	return ;
	}

	const usersStorage = storage('user');
    const users = usersStorage.get();
	const user = users.find( user => user.id == uid );

	res.json({data: user.profile});

});

/*
 * 我的地址 - 添加
 * @Method POST
 * @Url /address/add
 * @params uid 用户id
 * @Return {Object}
 * @TODO 没有完成的功能 - 我的地址 - 添加
 * */
server.post('/address/add', (req, res) => {
    const uid = Number(req.cookies.uid || req.query.uid || req.body.uid);
});

/*
 * 我的地址 - 修改
 * @Method POST
 * @Url /address/edit
 * @params uid 用户id
 * @Return {Object}
 * @TODO 没有完成的功能 - 我的地址 - 修改
 * */
server.post('/address/edit', (req, res) => {
    const uid = req.cookies.uid || req.query.uid || req.body.uid;
    const address_id = req.body.address_id;
});

/*
 * 我的地址 - 删除
 * @Method GET
 * @Url /address/remove
 * @params uid 用户id
 * @Return {Object}
 * @TODO 没有完成的功能 - 我的地址 - 删除
 * */
server.get('/address/remove', (req, res) => {
    const uid = Number(req.cookies.uid || req.query.uid);
    const address_id = req.body.address_id;
});

server.listen(port, host, () => {
    console.log('Server is started on 9999, click here -> http://localhost:9999 to open default browser!');
});
