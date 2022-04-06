package main

import (
	"fmt"
	"strings"

	"github.com/tetratelabs/proxy-wasm-go-sdk/proxywasm"
	"github.com/tetratelabs/proxy-wasm-go-sdk/proxywasm/types"
	"github.com/tidwall/gjson"
)

func main() {
	proxywasm.SetVMContext(&vmContext{})
}

type vmContext struct {
	// Embed the default VM context here,
	// so that we don't need to reimplement all the methods.
	types.DefaultVMContext
}

type kMamizFilter struct {
	// Embed the default plugin context here,
	// so that we don't need to reimplement all the methods.
	types.DefaultPluginContext
	totalRequestBodySize  int
	totalResponseBodySize int
}

func (*vmContext) NewPluginContext(contextID uint32) types.PluginContext {
	return &kMamizFilter{}
}

func (ctx *kMamizFilter) OnPluginStart(pluginConfigurationSize int) types.OnPluginStartStatus {
	return types.OnPluginStartStatusOK
}

func (*kMamizFilter) NewHttpContext(uint32) types.HttpContext { return &kMamizFilterContext{} }

type kMamizFilterContext struct {
	// Embed the default root http context here,
	// so that we don't need to reimplement all the methods.
	types.DefaultHttpContext
	totalRequestBodySize  int
	totalResponseBodySize int
	reqOutput             string
	resOutput             string
	isReqJson             bool
	isResJson             bool
}

func (ctx *kMamizFilterContext) OnHttpRequestHeaders(numHeaders int, _ bool) types.Action {
	headers, err := proxywasm.GetHttpRequestHeaders()
	if err != nil {
		return types.ActionContinue
	}
	output, isJson := createLogInfo("Request", headers)
	ctx.reqOutput = output
	ctx.isReqJson = isJson

	return types.ActionContinue
}

func (ctx *kMamizFilterContext) OnHttpResponseHeaders(numHeaders int, _ bool) types.Action {
	headers, err := proxywasm.GetHttpResponseHeaders()
	if err != nil {
		return types.ActionContinue
	}
	output, isJson := createLogInfo("Response", headers)
	ctx.resOutput = output
	ctx.isResJson = isJson

	return types.ActionContinue
}

func (ctx *kMamizFilterContext) OnHttpRequestBody(bodySize int, endOfStream bool) types.Action {
	if ctx.reqOutput == "" {
		return types.ActionContinue
	}

	ctx.totalRequestBodySize += bodySize
	if !endOfStream {
		// Wait until we see the entire body to replace.
		return types.ActionPause
	}

	if ctx.isReqJson && ctx.totalRequestBodySize > 0 {
		originalBody, err := proxywasm.GetHttpRequestBody(0, ctx.totalRequestBodySize)
		if err != nil {
			proxywasm.LogError("cannot get req body")
			proxywasm.LogError(err.Error())
			return types.ActionContinue
		}

		ctx.reqOutput += " [Body] " + parseObject(gjson.ParseBytes(originalBody))
	}

	proxywasm.LogInfo(ctx.reqOutput)
	proxywasm.LogWarn(ctx.reqOutput)
	return types.ActionContinue
}

func (ctx *kMamizFilterContext) OnHttpResponseBody(bodySize int, endOfStream bool) types.Action {
	ctx.totalResponseBodySize += bodySize
	if !endOfStream {
		// Wait until we see the entire body to replace.
		return types.ActionPause
	}

	if ctx.isResJson && ctx.totalResponseBodySize > 0 {
		originalBody, err := proxywasm.GetHttpResponseBody(0, ctx.totalResponseBodySize)
		if err != nil {
			proxywasm.LogError(err.Error())
			proxywasm.LogError("cannot get res body")
			return types.ActionContinue
		}

		ctx.resOutput += " [Body] " + parseObject(gjson.ParseBytes(originalBody))
	}

	proxywasm.LogInfo(ctx.resOutput)
	proxywasm.LogWarn(ctx.resOutput)
	return types.ActionContinue
}

func createLogInfo(direction string, headers [][2]string) (string, bool) {
	headerMap := map[string]string{}
	headerMap["content-type"] = ""
	headerMap["host"] = ""
	headerMap[":path"] = ""
	headerMap[":status"] = ""
	headerMap[":method"] = ""
	headerMap["x-request-id"] = "NO_ID"
	headerMap["x-b3-traceid"] = "NO_ID"
	headerMap["x-b3-spanid"] = "NO_ID"
	headerMap["x-b3-parentspanid"] = "NO_ID"

	for _, header := range headers {
		headerMap[header[0]] = header[1]
	}

	output := ""
	if direction == "Request" {
		output = fmt.Sprintf("[%s %s/%s/%s/%s] [%s %s%s]",
			direction,
			headerMap["x-request-id"],
			headerMap["x-b3-traceid"],
			headerMap["x-b3-spanid"],
			headerMap["x-b3-parentspanid"],
			headerMap[":method"],
			headerMap["host"],
			headerMap[":path"],
		)
	} else {
		output = fmt.Sprintf(
			"[%s %s/%s/%s/%s] [Status] %s",
			direction,
			headerMap["x-request-id"],
			headerMap["x-b3-traceid"],
			headerMap["x-b3-spanid"],
			headerMap["x-b3-parentspanid"],
			headerMap["status"],
		)
	}

	if headerMap["content-type"] != "" {
		output += " [ContentType " + headerMap["content-type"] + "]"
	}
	return output, headerMap["content-type"] == "application/json"
}

func parseObject(object gjson.Result) string {
	switch object.Type {
	case gjson.True:
		return `true`
	case gjson.False:
		return `false`
	case gjson.Null:
		return `null`
	case gjson.Number:
		return `0`
	case gjson.String:
		return `""`
	}
	if object.IsObject() {
		objList := []string{}
		object.ForEach(func(key gjson.Result, value gjson.Result) bool {
			objList = append(objList, fmt.Sprintf(`"%s": %s`, key.Value(), parseObject(value)))
			return true
		})
		return fmt.Sprintf(`{%s}`, strings.Join(objList, ", "))
	}
	if object.IsArray() {
		arr := []string{}
		object.ForEach(func(key gjson.Result, value gjson.Result) bool {
			arr = append(arr, parseObject(value))
			return true
		})
		return fmt.Sprintf(`[%s]`, strings.Join(arr, ", "))
	}
	return object.String()
}
