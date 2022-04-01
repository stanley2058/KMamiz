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
import { CacheableNames } from "../classes/Cacheable";
import { tgz } from "compressing";
import Logger from "../utils/Logger";
import DispatchStorage from "../services/DispatchStorage";

export default class DataService extends IRequestHandler {
  constructor() {
    super("data");
    this.addRoute("get", "/aggregate/:namespace?", async (req, res) => {
      res.json(await this.getAggregatedData(req.params["namespace"]));
    });
    this.addRoute("get", "/history/:namespace?", async (req, res) => {
      res.json(await this.getHistoricalData(req.params["namespace"]));
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
        ]);
        MongoOperator.getInstance().clearDatabase();
        res.sendStatus(200);
      });
      this.addRoute("get", "/export", async (_, res) => {
        res.contentType("application/tar+gzip");
        const json = JSON.stringify(DataCache.getInstance().export());
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
            s.on("end", () => {
              const caches = JSON.parse(
                Buffer.concat(chunks).toString("utf8")
              ) as [CacheableNames, any][];
              if (!caches) return res.sendStatus(400);
              DataCache.getInstance().import(caches);
              res.sendStatus(201);
            });
          });
          req.pipe(stream);
        } catch (err) {
          Logger.error("Error parsing import");
          Logger.plain.verbose("", err);
          res.sendStatus(400);
        }
      });
    }
  }

  async getAggregatedData(namespace?: string) {
    return await ServiceUtils.getInstance().getRealtimeAggregatedData(
      namespace
    );
  }

  async getHistoricalData(namespace?: string) {
    return await ServiceUtils.getInstance().getRealtimeHistoricalData(
      namespace
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
}
