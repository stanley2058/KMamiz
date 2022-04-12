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
	requestId             string
	traceId               string
}

func (ctx *kMamizFilterContext) OnHttpStreamDone() {
	if ctx.reqOutput != "" {
		proxywasm.LogWarn(ctx.reqOutput)
		proxywasm.LogInfo(ctx.reqOutput)
	}
	if ctx.resOutput != "" {
		proxywasm.LogWarn(ctx.resOutput)
		proxywasm.LogInfo(ctx.resOutput)
	}
}

func (ctx *kMamizFilterContext) OnHttpRequestHeaders(numHeaders int, _ bool) types.Action {
	ctx.getRequestIds()
	headers, err := proxywasm.GetHttpRequestHeaders()
	if err != nil {
		proxywasm.LogError("no request headers")
		return types.ActionContinue
	}
	output, isJson, isTarget := ctx.createLogInfo(0, &headers)
	if isTarget {
		ctx.reqOutput = output
		ctx.isReqJson = isJson
	}
	return types.ActionContinue
}

func (ctx *kMamizFilterContext) OnHttpResponseHeaders(numHeaders int, _ bool) types.Action {
	headers, err := proxywasm.GetHttpResponseHeaders()
	if err != nil {
		proxywasm.LogError("no response headers")
		return types.ActionContinue
	}
	output, isJson, isTarget := ctx.createLogInfo(1, &headers)
	if isTarget {
		ctx.resOutput = output
		ctx.isResJson = isJson
	}
	return types.ActionContinue
}

func (ctx *kMamizFilterContext) OnHttpRequestBody(bodySize int, endOfStream bool) types.Action {
	if ctx.reqOutput == "" {
		proxywasm.LogError("no request output")
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
	return types.ActionContinue
}

func (ctx *kMamizFilterContext) OnHttpResponseBody(bodySize int, endOfStream bool) types.Action {
	if ctx.resOutput == "" {
		return types.ActionContinue
	}

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
	return types.ActionContinue
}

func (ctx *kMamizFilterContext) getRequestIds() {
	requestId, err := proxywasm.GetHttpRequestHeader("x-request-id")
	if err != nil {
		requestId = "NO_ID"
	}
	traceId, err := proxywasm.GetHttpRequestHeader("x-b3-traceid")
	if err != nil {
		requestId = "NO_ID"
	}
	ctx.requestId = requestId
	ctx.traceId = traceId
}

func (ctx *kMamizFilterContext) createLogInfo(direction int, headers *[][2]string) (string, bool, bool) {
	headerMap := map[string]string{
		"content-type":      "",
		"host":              "",
		":path":             "",
		":status":           "",
		":method":           "",
		"x-request-id":      "NO_ID",
		"x-b3-traceid":      "NO_ID",
		"x-b3-spanid":       "NO_ID",
		"x-b3-parentspanid": "NO_ID",
	}

	for _, header := range *headers {
		headerMap[header[0]] = header[1]
	}

	if headerMap["x-request-id"] == "NO_ID" {
		headerMap["x-request-id"] = ctx.requestId
	}
	if headerMap["x-b3-traceid"] == "NO_ID" {
		headerMap["x-b3-traceid"] = ctx.traceId
	}

	output := ""
	if direction == 0 {
		output = fmt.Sprintf("[%s %s/%s/%s/%s] [%s %s%s]",
			"Request",
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
			"Response",
			headerMap["x-request-id"],
			headerMap["x-b3-traceid"],
			headerMap["x-b3-spanid"],
			headerMap["x-b3-parentspanid"],
			headerMap[":status"],
		)
	}

	if headerMap["content-type"] != "" {
		output += " [ContentType " + headerMap["content-type"] + "]"
	}
	return output, headerMap["content-type"] == "application/json", headerMap["x-b3-traceid"] != "NO_ID"
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
