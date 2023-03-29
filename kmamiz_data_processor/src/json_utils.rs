use std::collections::HashMap;

use serde_json::{Map, Value};

pub fn merge(objects: Vec<Value>) -> Value {
    let first = objects.first();
    if first.is_some() && first.unwrap().is_array() {
        merge_array(objects)
    } else {
        merge_object(objects)
    }
}

fn merge_object(objects: Vec<Value>) -> Value {
    let mut result = Map::new();
    for obj in objects {
        if let Value::Object(map) = obj {
            result.extend(map);
        }
    }
    Value::Object(result)
}
fn merge_array(arr: Vec<Value>) -> Value {
    let mut result = vec![];
    for item in arr {
        if let Value::Array(i) = item {
            result.extend(i);
        } else {
            result.push(item);
        }
    }
    Value::Array(result)
}

pub fn to_types(json: Value) -> String {
    let root_name = if json.is_array() { "ArrayItem" } else { "Root" };
    let mut type_map = HashMap::new();
    type_of(root_name, &json, &mut type_map);

    let mut types = vec![];
    let mut type_mapping = HashMap::new();
    let mut root = String::new();

    for (ty, name) in type_map.into_iter() {
        let t = vec![format!("type {name} = {{"), ty, "};".to_owned()].join("\n");
        if name == *"Root" {
            root = t;
        } else {
            type_mapping.insert(t.clone(), name);
            types.push(t);
        }
    }

    types.sort_by(|a, b| {
        type_mapping
            .get(a)
            .unwrap()
            .cmp(type_mapping.get(b).unwrap())
    });

    let schema = format!("{root}\n{}", types.join("\n"));
    if json.is_array() {
        format!("type Root = Array<ArrayItem>;{schema}")
    } else {
        schema
    }
}

fn type_of(name: &str, obj: &Value, addons: &mut HashMap<String, String>) -> Option<String> {
    match obj {
        Value::Null => None,
        Value::Bool(_) => Some("boolean".to_owned()),
        Value::Number(_) => Some("number".to_owned()),
        Value::String(_) => Some("string".to_owned()),
        Value::Array(arr) => {
            let first = arr.first();
            if let Some(val) = first {
                let ty = type_of(name, val, addons);
                if let Some(ty) = ty {
                    return Some(format!("{ty}[]"));
                }
            }
            Some("unknown[]".to_owned())
        }
        Value::Object(obj) => {
            let mut name: Vec<char> = name.chars().collect();
            name[0] = name[0].to_ascii_uppercase();
            let name = name.into_iter().collect::<String>();
            let mut types = vec![];

            for (n, val) in obj {
                let ty = type_of(n, val, addons);
                if let Some(ty) = ty {
                    types.push(format!("  {n}: {ty};"));
                } else {
                    types.push(format!("  {n}?: unknown;"));
                }
            }
            let ty = types.join("\n");
            let entry = addons.entry(ty).or_insert(name.clone());
            if entry.len() > name.len() {
                *entry = name;
            }

            Some(entry.clone())
        }
    }
}

#[test]
fn test_object_to_schema() {
    let json = r#"
      {
        "testNumber": 123,
        "testString": "test",
        "testArray": [1, 2, 3],
        "testObjArray": [{ "test": 123, "text": "test" }],
        "testObj": {
          "text": "test",
          "test": 1.1
        }
      }
    "#;
    let ans = r#"type Root = {
  testArray: number[];
  testNumber: number;
  testObj: TestObj;
  testObjArray: TestObj[];
  testString: string;
};
type TestObj = {
  test: number;
  text: string;
};"#;
    let res = to_types(serde_json::from_str(json).unwrap());
    assert_eq!(res, ans);

    let json = r#"[
      {
        "id": "61d58fabd7cb2766e01db3c6",
        "originId": null,
        "ordinaryUserName": null,
        "dataRequesterName": "新創公司A",
        "dataHolderName": "台灣電力公司",
        "firstSignDate": 0,
        "secondSignDate": 0,
        "signState": 0
      },
      {
        "id": "61d58facd7cb2766e01db7b0",
        "originId": null,
        "ordinaryUserName": null,
        "dataRequesterName": "新創公司A",
        "dataHolderName": "台灣電力公司",
        "firstSignDate": 0,
        "secondSignDate": 0,
        "signState": -3
      }
    ]"#;
    let ans = r#"type Root = Array<ArrayItem>;
type ArrayItem = {
  dataHolderName: string;
  dataRequesterName: string;
  firstSignDate: number;
  id: string;
  ordinaryUserName?: unknown;
  originId?: unknown;
  secondSignDate: number;
  signState: number;
};"#;
    let res = to_types(serde_json::from_str(json).unwrap());
    assert_eq!(res, ans);
}

#[test]
fn test_obj_merging() {
    let obj_a = serde_json::json!({"name":"test","nestObj":{"time":123}});
    let obj_b = serde_json::json!({"id":"123","nestObj":{"id":"123","array":[1,2,3,4,5]}});
    let merged = merge(vec![obj_a, obj_b]);

    assert_eq!(
        merged,
        serde_json::json!(
          {"name":"test","nestObj":{"id":"123","array":[1,2,3,4,5]},"id":"123"}
        )
    );

    let obj_a = serde_json::json!([{"name":"123"},{"name":"234","id":123}]);
    let obj_b = serde_json::json!([{"name":"456"},{"id":234},{"id":1234,"array":[1,2,3,4,5]}]);
    let merged = merge(vec![obj_a, obj_b]);

    assert_eq!(
        merged,
        serde_json::json!(
          [{"name":"123"},{"name":"234","id":123},{"name":"456"},{"id":234},{"id":1234,"array":[1,2,3,4,5]}]
        )
    );
}
