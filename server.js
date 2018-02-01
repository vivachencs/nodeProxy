/**
 * Created by Chen on 2018/2/1.
 */
const http = require('http')
const https = require('https')

const express = require('express')
// 引入 url 模块, 方便解析 url
const url = require('url')
const bodyParser = require('body-parser')
const nunjucks = require('nunjucks')

const app = express()

// 配置 bodyParser 以便获取 json 数据
app.use(bodyParser.json())
// 配置静态资源文件
const asset = __dirname + '/static'
app.use('/static', express.static(asset))

// 配置 nunjucks 模板, 第一个参数是模板文件的路径
nunjucks.configure('templates', {
	autoescape: true,
	express: app,
	noCache: true,
})

// 自定义 log 函数
const log = console.log.bind(console)

// 抽象出 http 和 https
const clientByProtocol = (protocol) => {
	if (protocol === 'http:') {
		return http
	} else {
		return https
	}
}

// 配置基础请求参数
const apiOptions = () => {
	// 获取系统环境变量
	// 设置默认 api 服务器地址
	const envServer = process.env.apiServer
	const defaultServer = 'http://127.0.0.1:4000'
	const server = envServer || defaultServer

	const result = url.parse(server)

	const obj = {
		headers: {
			'Content-Type': 'application/json',
		},
		// https 相关设置
		rejectUnauthorized: false,
	}
	const options = Object.assign({}, obj, result)

	if (options.href.length > 0) {
		delete options.href
	}
	return options
}

// 配置 api 请求参数
const httpOptions = (request) => {
	// 先获取基本的 api options 设置
	const baseOptions = apiOptions()
	// 设置请求的 path
	const pathOptions = {
		path: request.originalUrl,
	}
	log('debug pathOptions', pathOptions)
	const options = Object.assign({}, baseOptions, pathOptions)
	// 导入原始请求 headers 数据
	Object.keys(request.headers).forEach((k) => {
		options.headers[k] = request.headers[k]
	})
	// 设置请求的方法
	options.method = request.method
	return options
}

app.get('/', (request, response) => {
	response.render('index.html')
})

// 接受并转发所有请求路径符合 /api/* 的请求
app.all('/api/*', (request, response) => {
	const options = httpOptions(request)
	log('request options', options)
	const client = clientByProtocol(options.protocol)
	// 向 api 服务器发起请求
	const r = client.request(options, (res) => {
		// 保持状态码一致
		response.status(res.statusCode)
		log('debug res', res.headers, res.statusCode)
		// 设置响应头(复制)
		Object.keys(res.headers).forEach((k) => {
			const v = res.headers[k]
			response.setHeader(k, v)
		})
		res.on('data', (data) => {
			log('debug data', data.toString('utf8'))
			response.write(data)
		})

		res.on('end', () => {
			log('debug end')
			response.end()
		})

		// 响应发送错误
		res.on('error', () => {
			console.error(`error to request: ${request.url}`)
		})
	})

	// 发往 api server 的请求遇到问题
	r.on('error', (error) => {
		console.error(`请求 api server 遇到问题: ${request.url}`, error)
	})

	log('debug options method', options.method)
	// POST 请求处理
	if (options.method !== 'GET') {
		const body = JSON.stringify(request.body)
		log('debug body', body, typeof body)
		// 把 body 里的数据发送到 api server
		r.write(body)
	}

	r.end()
})

const run = (port=3000, host='') => {
	const server = app.listen(port, host, () => {
		const address = server.address()
		host = address.address
		port = address.port
		log(`server started at http://${host}:${port}`)
	})
}

if (require.main === module) {
	const port = 3300
	const host = '127.0.0.1'
	run(port, host)
}