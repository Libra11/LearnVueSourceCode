/* not type checking this file because flow doesn't play well with Proxy */

import config from 'core/config'
import { warn, makeMap, isNative } from '../util/index'
// // 声明 initProxy 变量
let initProxy

// 在生产环境下我们导出的 initProxy 实际上就是 undefined。只有在非生产环境下导出的 initProxy 才会有值
if (process.env.NODE_ENV !== 'production') {
  // 可以看到 allowedGlobals 实际上是通过 makeMap 生成的函数，
  // 所以 allowedGlobals 函数的作用是判断给定的 key 是否出现在上面字符串中定义的关键字中的。这些关键字都是在 js 中可以全局访问的
  // 下面这些全局变量都是可以在{{}}中访问的
  const allowedGlobals = makeMap(
    'Infinity,undefined,NaN,isFinite,isNaN,' +
    'parseFloat,parseInt,decodeURI,decodeURIComponent,encodeURI,encodeURIComponent,' +
    'Math,Number,Date,Array,Object,Boolean,String,RegExp,Map,Set,JSON,Intl,' +
    'require' // for Webpack/Browserify
  )

  const warnNonPresent = (target, key) => {
    warn(
      `Property or method "${key}" is not defined on the instance but ` +
      'referenced during render. Make sure that this property is reactive, ' +
      'either in the data option, or for class-based components, by ' +
      'initializing the property. ' +
      'See: https://vuejs.org/v2/guide/reactivity.html#Declaring-Reactive-Properties.',
      target
    )
  }

  const warnReservedPrefix = (target, key) => {
    warn(
      `Property "${key}" must be accessed with "$data.${key}" because ` +
      'properties starting with "$" or "_" are not proxied in the Vue instance to ' +
      'prevent conflicts with Vue internals. ' +
      'See: https://vuejs.org/v2/api/#data',
      target
    )
  }

  // hasProxy 顾名思义，这是用来判断宿主环境是否支持 js 原生的 Proxy 特性的
  const hasProxy =
    typeof Proxy !== 'undefined' && isNative(Proxy)

  if (hasProxy) {
    const isBuiltInModifier = makeMap('stop,prevent,self,ctrl,shift,alt,meta,exact')
    config.keyCodes = new Proxy(config.keyCodes, {
      set(target, key, value) {
        if (isBuiltInModifier(key)) {
          warn(`Avoid overwriting built-in modifier in config.keyCodes: .${key}`)
          return false
        } else {
          target[key] = value
          return true
        }
      }
    })
  }

  const hasHandler = {
    /**
     * has 可以拦截以下操作：
        属性查询: foo in proxy
        继承属性查询: foo in Object.create(proxy)
        with 检查: with(proxy) { (foo); }
        Reflect.has()
     */
    has(target, key) {
      const has = key in target
      // 如果 key 在 allowedGlobals 之内，或者 key 是以下划线 _ 开头的字符串，则为真
      const isAllowed = allowedGlobals(key) ||
        (typeof key === 'string' && key.charAt(0) === '_' && !(key in target.$data))
      // 如果 has 和 isAllowed 都为假，使用 warnNonPresent 函数打印错误
      if (!has && !isAllowed) {
        if (key in target.$data) warnReservedPrefix(target, key)
        else warnNonPresent(target, key)
      }
      return has || !isAllowed
    }
  }

  const getHandler = {
    get(target, key) {
      if (typeof key === 'string' && !(key in target)) {
        if (key in target.$data) warnReservedPrefix(target, key)
        else warnNonPresent(target, key)
      }
      return target[key]
    }
  }

  //  initProxy 的作用实际上就是对实例对象 vm 的代理，通过原生的 Proxy 实现
  initProxy = function initProxy(vm) {
    if (hasProxy) {
      // determine which proxy handler to use
      const options = vm.$options
      // 如果 Proxy 存在，那么将会使用 Proxy 对 vm 做一层代理，代理对象赋值给 vm._renderProxy，
      // 所以今后对 vm._renderProxy 的访问，如果有代理那么就会被拦截。代理对象配置参数是 handlers，
      // 可以发现 handlers 既可能是 getHandler 又可能是 hasHandler，至于到底使用哪个，是由判断条件决定的
      // 一般都使用 hasHandler 
      const handlers = options.render && options.render._withStripped
        ? getHandler
        : hasHandler
      // vm._renderProxy 在 core/instance/render.js 文件中的 Vue.prototype._render 使用到了
      vm._renderProxy = new Proxy(vm, handlers)
    } else {
      vm._renderProxy = vm
    }
  }
}

export { initProxy }
