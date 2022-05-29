import IRequestHandler from "../entities/TRequestHandler";
import DataCache from "../services/DataCache";
import { TEndpointDataType } from "../entities/TEndpointDataType";
import { TEndpointLabel } from "../entities/TEndpointLabel";
import { TTaggedInterface } from "../entities/TTaggedInterface";
import { CLabelMapping } from "../classes/Cacheable/CLabelMapping";
import { CUserDefinedLabel } from "../classes/Cacheable/CUserDefinedLabel";
import { CTaggedInterfaces } from "../classes/Cacheable/CTaggedInterfaces";
import { CEndpointDataType } from "../classes/Cacheable/CEndpointDataType";
import ServiceUtils from "../services/ServiceUtils";
import { CCombinedRealtimeData } from "../classes/Cacheable/CCombinedRealtimeData";
import { CEndpointDependencies } from "../classes/Cacheable/CEndpointDependencies";
import { CLabeledEndpointDependencies } from "../classes/Cacheable/CLabeledEndpointDependencies";
import { CReplicas } from "../classes/Cacheable/CReplicas";
import { CTaggedSwaggers } from "../classes/Cacheable/CTaggedSwaggers";
import GlobalSettings from "../GlobalSettings";
import MongoOperator from "../services/MongoOperator";
import { tgz } from "compressing";
import Logger from "../utils/Logger";
import DispatchStorage from "../services/DispatchStorage";
import { TAggregatedData } from "../entities/TAggregatedData";
import { AggregatedDataModel } from "../entities/schema/AggregatedDataSchema";
import { THistoricalData } from "../entities/THistoricalData";
import { HistoricalDataModel } from "../entities/schema/HistoricalDataSchema";
import ServiceOperator from "../services/ServiceOperator";
import { CLookBackRealtimeData } from "../classes/Cacheable/CLookBackRealtimeData";

export default class DataService extends IRequestHandler {
  constructor() {
    super("data");
    this.addRoute("get", "/aggregate/:namespace?", async (req, res) => {
      const notBeforeQuery = req.query["notBefore"] as string;
      const notBefore = notBeforeQuery ? parseInt(notBeforeQuery) : undefined;
      res.json(
        await this.getAggregatedData(req.params["namespace"], notBefore)
      );
    });
    this.addRoute("get", "/history/:namespace?", async (req, res) => {
      const notBeforeQuery = req.query["notBefore"] as string;
      const notBefore = notBeforeQuery ? parseInt(notBeforeQuery) : undefined;
      res.json(
        await this.getHistoricalData(req.params["namespace"], notBefore)
      );
    });
    this.addRoute("get", "/datatype/:uniqueLabelName", async (req, res) => {
      const labelName = decodeURIComponent(req.params["uniqueLabelName"]);
      if (!labelName) res.sendStatus(400);
      else {
        const result = await this.getEndpointDataType(labelName);
        if (result) res.json(result);
        else res.sendStatus(404);
      }
    });
    this.addRoute("get", "/label", async (_, res) => {
      res.json(this.getLabelMap());
    });
    this.addRoute("get", "/label/user", async (_, res) => {
      const userLabels = this.getUserDefinedLabel();
      if (userLabels) return res.json(userLabels);
      res.sendStatus(404);
    });
    this.addRoute("post", "/label/user", async (req, res) => {
      const labels = req.body as TEndpointLabel;
      if (!labels?.labels) return res.sendStatus(400);
      this.updateUserDefinedLabel(labels);
      res.sendStatus(201);
    });
    this.addRoute("delete", "/label/user", async (req, res) => {
      const label = req.body as {
        uniqueServiceName: string;
        method: string;
        label: string;
      };
      if (!label) return res.sendStatus(400);
      this.deleteUserDefinedLabel(
        label.uniqueServiceName,
        label.method,
        label.label
      );
      res.sendStatus(204);
    });
    this.addRoute("get", "/interface", async (req, res) => {
      const { uniqueLabelName } = req.query as {
        uniqueLabelName: string;
      };
      if (!uniqueLabelName) return res.sendStatus(400);
      res.json(this.getTaggedInterface(decodeURIComponent(uniqueLabelName)));
    });
    this.addRoute("post", "/interface", async (req, res) => {
      const tagged = req.body as TTaggedInterface;
      if (!tagged) return res.sendStatus(400);
      this.addTaggedInterface(tagged);
      res.sendStatus(201);
    });
    this.addRoute("delete", "/interface", async (req, res) => {
      const { uniqueLabelName, userLabel } = req.body as {
        uniqueLabelName: string;
        userLabel: string;
      };
      if (!uniqueLabelName || !userLabel) return res.sendStatus(400);
      const result = this.deleteTaggedInterface(uniqueLabelName, userLabel);
      res.sendStatus(result ? 204 : 400);
    });

    this.addRoute("post", "/sync", async (_, res) => {
      await DispatchStorage.getInstance().syncAll();
      res.sendStatus(200);
    });

    if (GlobalSettings.EnableTestingEndpoints) {
      this.addRoute("delete", "/clear", async (_, res) => {
        await this.clearData();
        res.sendStatus(200);
      });
      this.addRoute("get", "/export", async (_, res) => {
        res.contentType("application/tar+gzip");
        const json = await this.exportData();
        const stream = new tgz.Stream();
        stream.addEntry(Buffer.from(json, "utf8"), {
          relativePath: "KMamiz.cache.json",
        });
        stream.on("end", () => res.end());
        stream.pipe(res);
      });
      this.addRoute("post", "/import", async (req, res) => {
        try {
          const chunks: any[] = [];
          const stream = new tgz.UncompressStream();
          stream.on("entry", (_, s) => {
            s.on("data", (chunk: any) => chunks.push(chunk));
            s.on("end", async () => {
              const caches = JSON.parse(
                Buffer.concat(chunks).toString("utf8")
              ) as [string, any][];
              const result = await this.importData(caches);
              res.sendStatus(result ? 201 : 400);
            });
          });
          req.pipe(stream);
        } catch (err) {
          Logger.error("Error parsing import");
          Logger.plain.verbose("", err);
          res.sendStatus(400);
        }
      });
      this.addRoute("post", "/aggregate", async (_, res) => {
        await ServiceOperator.getInstance().createHistoricalAndAggregatedData();
        res.sendStatus(204);
      });
    }
  }

  async getAggregatedData(namespace?: string, notBefore?: number) {
    return await ServiceUtils.getInstance().getRealtimeAggregatedData(
      namespace,
      notBefore
    );
  }

  async getHistoricalData(namespace?: string, notBefore?: number) {
    return await ServiceUtils.getInstance().getRealtimeHistoricalData(
      namespace,
      notBefore
    );
  }

  async getEndpointDataType(
    uniqueLabelName: string
  ): Promise<TEndpointDataType | null> {
    const [service, namespace, version, method, label] =
      uniqueLabelName.split("\t");
    if (!method || !label) return null;

    const uniqueServiceName = `${service}\t${namespace}\t${version}`;

    const datatype = DataCache.getInstance()
      .get<CLabelMapping>("LabelMapping")
      .getEndpointDataTypesByLabel(
        label,
        uniqueServiceName,
        method,
        DataCache.getInstance()
          .get<CEndpointDataType>("EndpointDataType")
          .getData() || []
      );

    if (datatype.length === 0) return null;
    const merged = datatype.reduce((prev, curr) => prev.mergeSchemaWith(curr));
    return { ...merged.toJSON(), labelName: label };
  }

  getLabelMap() {
    const entries = DataCache.getInstance()
      .get<CLabelMapping>("LabelMapping")
      .getData()
      ?.entries();
    return entries ? [...entries] : [];
  }

  getUserDefinedLabel() {
    return DataCache.getInstance()
      .get<CUserDefinedLabel>("UserDefinedLabel")
      .getData();
  }

  updateUserDefinedLabel(label: TEndpointLabel) {
    DataCache.getInstance()
      .get<CUserDefinedLabel>("UserDefinedLabel")
      .update(label);
    ServiceUtils.getInstance().updateLabel();
  }

  deleteUserDefinedLabel(
    uniqueServiceName: string,
    method: string,
    label: string
  ) {
    DataCache.getInstance()
      .get<CUserDefinedLabel>("UserDefinedLabel")
      .delete(label, uniqueServiceName, method);
    ServiceUtils.getInstance().updateLabel();
  }

  getTaggedInterface(uniqueLabelName: string) {
    return DataCache.getInstance()
      .get<CTaggedInterfaces>("TaggedInterfaces")
      .getData(uniqueLabelName);
  }

  addTaggedInterface(tagged: TTaggedInterface) {
    DataCache.getInstance()
      .get<CTaggedInterfaces>("TaggedInterfaces")
      .add(tagged);
  }

  deleteTaggedInterface(uniqueLabelName: string, userLabel: string) {
    const existing = DataCache.getInstance()
      .get<CTaggedInterfaces>("TaggedInterfaces")
      .getData(uniqueLabelName)
      .find((i) => i.userLabel === userLabel);
    if (!existing || existing.boundToSwagger) return false;

    DataCache.getInstance()
      .get<CTaggedInterfaces>("TaggedInterfaces")
      .delete(uniqueLabelName, userLabel);
    return true;
  }

  async exportData() {
    const caches = DataCache.getInstance().export();
    const aggregatedData =
      await MongoOperator.getInstance().getAggregatedData();
    const historicalData =
      await MongoOperator.getInstance().getHistoricalData();
    const json = JSON.stringify([
      ...caches,
      ["AggregatedData", aggregatedData],
      ["HistoricalData", historicalData],
    ]);
    return json;
  }

  async clearData() {
    DataCache.getInstance().clear();
    DataCache.getInstance().register([
      new CLabelMapping(),
      new CEndpointDataType(),
      new CCombinedRealtimeData(),
      new CEndpointDependencies(),
      new CReplicas(),
      new CTaggedInterfaces(),
      new CTaggedSwaggers(),
      new CLabeledEndpointDependencies(),
      new CUserDefinedLabel(),
      new CLookBackRealtimeData(),
    ]);
    await MongoOperator.getInstance().clearDatabase();
  }

  async importData(importData: [string, any][]) {
    if (!importData) return false;

    await MongoOperator.getInstance().clearDatabase();

    // fix Date being converted into string
    const dataType = importData.find(
      ([name]) => name === "EndpointDataType"
    )![1];
    dataType.forEach((dt: any) =>
      dt.schemas.forEach((s: any) => (s.time = new Date(s.time)))
    );

    DataCache.getInstance().import(importData);
    DataCache.getInstance().register([new CLookBackRealtimeData()]);

    const [, aggregatedData] =
      importData.find(([name]) => name === "AggregatedData") || [];
    const [, historicalData] =
      importData.find(([name]) => name === "HistoricalData") || [];

    await MongoOperator.getInstance().insertMany(
      [aggregatedData as TAggregatedData],
      AggregatedDataModel
    );
    await MongoOperator.getInstance().insertMany(
      historicalData as THistoricalData[],
      HistoricalDataModel
    );

    await DispatchStorage.getInstance().syncAll();
    ServiceUtils.getInstance().updateLabel();
    return true;
  }
}
