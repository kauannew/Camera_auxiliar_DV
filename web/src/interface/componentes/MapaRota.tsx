import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useMemo, useRef } from "react";
import { CircleMarker, GeoJSON, MapContainer, TileLayer } from "react-leaflet";
import type { Rota } from "../rotas/apiRotas";

// Tiles do OpenStreetMap (sem chave de API), escurecidos por CSS (`.mapa-escuro`) para combinar com o tema.
// Uso leve (demo) é permitido pela política do OSM; para produção/tráfego alto, aponte VITE_MAPA_TILES
// para um provedor com chave (MapTiler, Stadia...) — veja web/README.md.
// `crossOrigin` é obrigatório: o app é servido com COEP (require-corp) para o ONNX Runtime,
// e imagens de outra origem só carregam se vierem por CORS.
const TILES_PERSONALIZADOS = import.meta.env.VITE_MAPA_TILES as string | undefined;
const TILES = TILES_PERSONALIZADOS ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATRIBUICAO = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const botaoZoom =
  "flex size-12 items-center justify-center rounded-lg border-2 border-black bg-acao text-[1.75rem] font-bold leading-none text-black shadow-lg active:scale-95";

interface Props {
  rota: Rota;
}

/** Desenha a linha `geometria` (GeoJSON) da rota, com origem e destino. */
export function MapaRota({ rota }: Props) {
  const mapaRef = useRef<L.Map | null>(null);

  const { limites, origem, destino } = useMemo(() => {
    const coords = rota.geometria.coordinates; // GeoJSON é [lon, lat]; Leaflet usa [lat, lon]
    const primeiro = coords[0];
    const ultimo = coords[coords.length - 1];
    return {
      limites: L.geoJSON(rota.geometria).getBounds(),
      origem: [primeiro[1], primeiro[0]] as [number, number],
      destino: [ultimo[1], ultimo[0]] as [number, number],
    };
  }, [rota.geometria]);

  return (
    // `isolate` cria um contexto de empilhamento: os z-index internos do Leaflet (até 1000)
    // não passam por cima da barra de abas nem da borda de alerta.
    <div
      role="group"
      aria-label="Mapa da rota. É apenas visual: o trajeto completo está em texto, na lista de passos abaixo."
      className="relative isolate h-[42dvh] min-h-[16rem] overflow-hidden rounded-[1.25rem] border-4 border-acao"
    >
      <MapContainer
        ref={mapaRef}
        bounds={limites}
        boundsOptions={{ padding: [32, 32] }}
        zoomControl={false}
        keyboard={false}
        className={`${TILES_PERSONALIZADOS ? "" : "mapa-escuro "}size-full`}
      >
        <TileLayer url={TILES} attribution={ATRIBUICAO} maxZoom={19} crossOrigin={true} />
        {/* Contorno preto por baixo da linha amarela: destaca a rota em qualquer fundo */}
        <GeoJSON data={rota.geometria} style={{ color: "#000", weight: 11, opacity: 0.9 }} interactive={false} />
        <GeoJSON data={rota.geometria} style={{ color: "#ffd600", weight: 6, opacity: 1 }} interactive={false} />
        <CircleMarker
          center={origem}
          radius={11}
          pathOptions={{ color: "#000", weight: 3, fillColor: "#32d74b", fillOpacity: 1 }}
          interactive={false}
        />
        <CircleMarker
          center={destino}
          radius={11}
          pathOptions={{ color: "#000", weight: 3, fillColor: "#ff453a", fillOpacity: 1 }}
          interactive={false}
        />
      </MapContainer>

      {/* Zoom próprio: botões grandes e rotulados (os do Leaflet são pequenos e sem rótulo útil) */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
        <button type="button" aria-label="Aproximar o mapa" className={botaoZoom} onClick={() => mapaRef.current?.zoomIn()}>
          +
        </button>
        <button type="button" aria-label="Afastar o mapa" className={botaoZoom} onClick={() => mapaRef.current?.zoomOut()}>
          −
        </button>
      </div>
    </div>
  );
}
