export type ShopCategory = "shop" | "museum" | "airport" | "train_station";

export type Shop = {
  id: string;
  name: string;
  category?: ShopCategory;
  initials: string;
  logo?: string;
  logoText?: string;
  logoBackground?: "light" | "dark";
  type: string;
  productRange: string;
  priceRange: string;
  contact: string;
  fit: string;
  address: string;
  neighborhood: string;
  website: string;
  directionsUrl?: string;
  lat: number;
  lng: number;
  note?: string;
  visitStatus?: "visited" | "not_visited";
  reachOutSent?: boolean;
  followupSent?: boolean;
  manualNotes?: string;
};

export type ShopInput = Omit<Shop, "id">;

export const initialShops: Shop[] = [
  {
    id: "la-postalera",
    name: "La Postalera",
    initials: "LP",
    logo: "https://www.lapostalera.es/cdn/shop/files/logpostanim2_43e121ec-2611-4977-bbbf-3366bcf23a21.gif?v=1695661157&width=400",
    type: "Postales, regalos & souvenirs que cuentan historias",
    productRange:
      "La Postalera specialises in modern, artist-designed souvenirs and works with different artists and small brands. Its customers are already searching for an original visual memory of Madrid, making it one of the most natural locations for an Ambar countertop stand",
    priceRange:
      "Postcards €1.50 - €5\nPrints from €10 - €15\nMadrid-style fans €12.95\nTiles €14.95\nBags around €35",
    contact: "info@lapostalera.es",
    fit: "A compact Ambar display would fit naturally alongside its Madrid postcards, prints and artist-designed souvenirs, offering customers a more interactive and emotional way to take home a memory of the city.",
    address: "Corre. Baja de San Pablo, 15, Centro, 28004 Madrid",
    neighborhood: "Malasaña",
    website: "https://www.lapostalera.es/",
    lat: 40.4220623,
    lng: -3.7044647,
  },
  {
    id: "el-moderno",
    name: "El Moderno",
    initials: "EM",
    logo: "https://elmoderno.es/cdn/shop/files/logo-el_moderno_concept.jpg?v=1744644513&width=400",
    type: "Concept store",
    productRange:
      "El Moderno combines independent brands, illustration, craftsmanship and original gifts in a high-traffic Malasaña location",
    priceRange:
      "Stickers €2.90\nMadrid magnets €6.50\nNeighbourhood maps €16\nMadrid travel diary €16.90\nMadrid objects around €19 - €39\nTraveler's accessories €18 - €59\nPrints mainly around €19.90 - €29.90\nArtist prints €100+",
    contact: "info@elmoderno.es",
    fit: "A compact Ambar display would fit naturally alongside its Madrid prints, postcards and design-led gift products.",
    address: "Corredera Baja de San Pablo, 19, Centro, 28004, Madrid",
    neighborhood: "Malasaña",
    website: "https://elmoderno.es/",
    lat: 40.4223045,
    lng: -3.704195,
  },
  {
    id: "peseta",
    name: "Peseta",
    initials: "PE",
    logoText: "peSeta",
    type: "Moda lentita hecha en españa desde principios de siglo",
    productRange:
      "Sustainable fashion and design brand known for colourful, locally made clothing, textile accessories and original stationery. Its mix of bags, small accessories, notebooks, postcards and artist illustrations attracts customers who value independent Spanish design and craftsmanship.",
    priceRange: "Papelería €2 - €20",
    contact: "peseta@peseta.org",
    fit: "A compact Ambar display would fit naturally alongside its stationery and small gift products, adding a complementary Madrid-focused keepsake without competing with its core fashion range.",
    address: "Corre. Baja de San Pablo, 26, Centro, 28004 Madrid",
    neighborhood: "Malasaña",
    website: "https://www.casapeseta.es/",
    lat: 40.4234327,
    lng: -3.7025557,
  },
  {
    id: "nest",
    name: "Nest",
    initials: "NE",
    logo: "https://nest-boutique.com/cdn/shop/files/Nest_Logo_colour_300x300.jpg?v=1614440735",
    type: "Boutique",
    productRange:
      "Nest is an independent boutique focused on carefully selected stationery, greeting cards, small gifts, home accessories and design-led objects. Its assortment is compact, colourful and highly giftable, with products sourced from different independent brands and designers",
    priceRange: "Papelería €2 - €20+",
    contact: "info@nest-boutique.com",
    fit: "Nest specialises in small, attractive and easily giftable products from different suppliers. Ambar could work as a compact impulse purchase near the card, stationery or checkout area without requiring a large floor stand.",
    address: "Pl. de San Ildefonso, 3, Centro, 28004 Madrid",
    neighborhood: "Malasaña",
    website: "https://nest-boutique.com/",
    lat: 40.4240783,
    lng: -3.7023015,
  },
  {
    id: "curiosite",
    name: "Curiosite",
    initials: "CU",
    logo: "https://www.curiosite.es/assets2024/images/header/logo_curiosite.png",
    logoBackground: "dark",
    type: "Regalos originales",
    productRange:
      "Curiosite specialises in original, surprising and design-led gifts across home décor, gadgets, games, books, photography and personal accessories. Its broad assortment focuses on unusual, demonstrable products that customers can discover as gifts for different occasions and price points",
    priceRange:
      "Home & décor mainly around €10 - €40\nPremium items €50 - €79\nGadgets & tech €7 - €50\nGames, toys & DIY kits €9 - €40\nBooks & activity books €10 - €25\nOffice & desk accessories €6 - €30\nPremium design objects €59 - €139\nPhotography €25 - €79\nPremium cameras €229\nFashion, travel & personal accessories €5 - €30\nLuggage around €130\nParty & novelty items €6 - €15",
    contact: "olivia@curiosite.es",
    fit: "Curiosite customers expect surprising, interactive and demonstrable gifts. Ambar’s tap-to-unlock experience could be shown quickly through a live counter unit and positioned as an innovative emotional gift rather than a traditional souvenir.",
    address: "Corre. Alta de San Pablo, 28, Centro, 28004 Madrid",
    neighborhood: "Malasaña",
    website: "https://www.curiosite.es/",
    lat: 40.4263542,
    lng: -3.7016795,
  },
  {
    id: "postal-y-tinta",
    name: "Postal y Tinta",
    initials: "PT",
    logo: "https://postalytinta.com/wp-content/uploads/2025/05/postal-y-tinta-logo-300x37.webp",
    type: "Tienda y taller de grabado ilustración",
    productRange:
      "An independent illustration and printmaking workshop in Barrio de las Letras, focused on handmade postcards, prints and engravings. Its products are built around storytelling, emotional memory and small-format art, with designs created by independent artists and a strong connection to Madrid",
    priceRange: "Postal cards €3+\nPoster €20",
    contact: "postalytinta@gmail.com",
    fit: "Rather than simply placing Ambar alongside the postcards, a collaboration or illustrated Madrid Stamp could fit particularly naturally with the shop's artist-led identity.",
    address: "C. de la Alameda, 8, Centro, 28014 Madrid",
    neighborhood: "Barrio de las Letras",
    website: "https://postalytinta.com/",
    lat: 40.4121475,
    lng: -3.693932,
  },
  {
    id: "real-fabrica-espanola",
    name: "Real Fábrica Española",
    initials: "RF",
    logo: "https://realfabrica.com/cdn/shop/files/RF-logo-espanola-sin-burro-2kx1k.png?v=1681726832&width=400",
    type: "Gift shop",
    productRange:
      "A curated celebration of traditional Spanish craftsmanship, heritage brands and products with a strong story of origin. The Cervantes store mixes Madrid souvenirs with books, artisanal objects, food, ceramics and nostalgic Spanish products, positioning them as cultural objects rather than conventional tourist merchandise",
    priceRange: "Libros/guías €15+\nPapelería €3+\nArtesanía €8+",
    contact: "hola@realfabrica.com",
    fit: "The Stamp could sit alongside Madrid books, guides and curated local gifts as a contemporary way of preserving a trip, adding a digital layer to a store otherwise rooted in Spanish heritage and physical craftsmanship.",
    address: "Calle de Cervantes, 9, Centro, 28014 Madrid",
    neighborhood: "Barrio de las Letras",
    website: "https://realfabrica.com/",
    lat: 40.4143782,
    lng: -3.6977128,
  },
  {
    id: "la-cacharreria-concept-store",
    name: "La Cacharreria Concept Store",
    initials: "LC",
    logo: "https://lacacharreriaconceptstore.com/wp-content/uploads/2025/03/logo-dark-retina-600x106.png",
    type: "Concept store",
    productRange:
      "A design-focused concept store/showroom bringing together established international and emerging designers across furniture, lighting and home accessories. For Ambar, the relevant part of the assortment is its smaller giftable products: stationery, decorative objects, ceramics, small electronics and artist/design collaborations",
    priceRange:
      "Small design objects €15 - €30\nStationery / small paper goods €8 - €20\nCeramics / decorative trays €15 - €30\nPrinted home accessories €12 - €20\nDecorative glassware €15 - €25\nSmall functional gifts €10 - €30\nCompact interactive/design products €20 - €35\nArtist / designer collaboration pieces €15 - €30\nLifestyle accessories €10 - €35",
    contact: "info@lacacharreriaconceptstore.com",
    fit: "More of a design-object fit than a Madrid-souvenir fit. Ambar could work here if presented as a compact, visually strong and interactive design product rather than as traditional tourist merchandise. It would benchmark whether the Stamp can compete with premium lifestyle objects purely on design and experience.",
    address: "Calle Mayor, 20, Centro, 28013 Madrid",
    neighborhood: "Sol",
    website: "https://lacacharreriaconceptstore.com/",
    lat: 40.4163781,
    lng: -3.7069079,
  },
  {
    id: "la-integral",
    name: "La Integral",
    initials: "LI",
    logo: "https://www.laintegral25.com/wp-content/uploads/2021/05/cropped-LOGO-AMARILLO-scaled-1-300x300.jpg",
    type: "Novelty store",
    productRange:
      "An independent Madrid store combining contemporary art, music and design through products from local creators and small independent brands. Its assortment includes fanzines, paper goods, graphic work, ceramics, accessories, totes, candles, books and unusual objects, with a strong emphasis on local production and small runs",
    priceRange:
      "Stickers/small paper goods €5 - €10\nFanzines €10+\nSmall gifts/accessories €9 - €25\nTotes €12 - €35\nCandles/ceramics €20 - €25\nIndependent design products broadly €10 - €35",
    contact: "laintegral25@gmail.com",
    fit: "Strong independent-brand fit. Ambar could sit among the shop's local creator products as a new Madrid-designed collectible. Because La Integral actively works with independent artists and small-batch local products, it could also be a good environment for testing a limited-edition or artist-collaboration Stamp.",
    address: "C. del León, 25, Centro, 28014 Madrid",
    neighborhood: "Barrio de las Letras",
    website: "https://www.laintegral25.com/",
    lat: 40.413112,
    lng: -3.6990022,
  },
  {
    id: "es-madrid",
    name: "Es Madrid",
    initials: "MD",
    logo: "https://estaticos.esmadrid.com/cdn/farfuture/xsD1bow1PJUGTNNYvBO1qWYtMc3TU83Pc4HRTrQY5Cs/mtime:1778741946/profiles/clusters_public/themes/clusters_public_static/logo-madrid-ayto.svg",
    type: "Tienda oficial turismo Madrid",
    productRange:
      "The official city shop in Plaza Mayor showcases Madrid through products made by local artisans and designers. Its assortment ranges from postcards, stationery and travel books to ceramics, food, fashion and higher-end Madrid craftsmanship, making the shop a direct showcase of the city's identity and culture",
    priceRange: '"Official Madrid Merch" €5+',
    contact: "turismo@esmadrid.com",
    fit: "The Stamp could sit beside Madrid guides, postcards and “Hecho en Madrid” products as an official-quality digital souvenir. The opportunity is attractive because customers are explicitly looking for a memory of Madrid, although entry would likely require a more formal approval or procurement process than an independent concept store.",
    address: "Plaza Mayor, Centro, 28013 Madrid",
    neighborhood: "Plaza Mayor",
    website: "https://www.esmadrid.com/informacion-turistica/centro-de-turismo-plaza-mayor",
    lat: 40.4158291,
    lng: -3.7073999,
  },
  {
    id: "el-escudo-de-toledo",
    name: "El Escudo de Toledo",
    category: "shop",
    initials: "ET",
    logoText: "Escudo",
    type: "Artesanía & souvenir / gift shop",
    productRange:
      "Traditional gift and souvenir store close to Madrid's main museum district, focused on Spanish craftsmanship and cultural keepsakes. Its assortment includes Madrid and Toledo souvenirs, Menina-inspired objects, heraldry and family crests, jewellery, decorative pieces and other traditional gift items. Public listings position it as more craftsmanship-led than a standard mass-tourist souvenir store",
    priceRange: "Magnets €2\nPremium magnets €5+\nKeychains €7+\nPostcards €2+",
    contact: "escudotoledo@gmail.com",
    fit: "Ambar could provide a contemporary contrast to its physical Madrid keepsakes, offering visitors a more interactive way to preserve their trip. Particularly useful for testing whether a digital-memory product can sit naturally alongside traditional Spanish souvenirs without feeling overly technological.",
    address: "Plaza Cánovas del Castillo 4, 28014 Madrid",
    neighborhood: "",
    website: "",
    lat: 40.4146851,
    lng: -3.6945994,
  },
  {
    id: "thyssen-bornemisza-museo-nacional",
    name: "Thyssen-Bornemisza Museo Nacional",
    category: "museum",
    initials: "TB",
    logoText: "Thyssen",
    type: "Tienda oficial museo",
    productRange:
      "Highly curated museum store built around the Thyssen collection, exhibitions and collaborations with external designers, artisans and brands. The assortment spans books, prints, stationery, ceramics, textiles, accessories, design objects and exclusive products that reinterpret works from the museum through contemporary design. The shop explicitly describes collaboration with brands and designers as part of its identity.",
    priceRange: "Postcards €2+\nLamina €4\nPaper accessories €2+\nBooks €12 - €40\nPosters €10+\nHome accessories €15+ - €50",
    contact: "(Mamen Bustamante Navarro - Compras y Desarrollo de Producto) mbustamante@museothyssen.org",
    fit: "The most natural fit would be an Ambar × Thyssen edition that turns the museum visit into a collectible memory and unlocks digital content connected to artworks, stories and recommendations. Their existing collaboration model makes this particularly relevant.",
    address: "Paseo del Prado, 8, 28014 Madrid",
    neighborhood: "",
    website: "https://tienda.museothyssen.org/",
    lat: 40.4162159,
    lng: -3.6949317,
  },
  {
    id: "reina-sofia",
    name: "Reina Sofía",
    category: "museum",
    initials: "RS",
    logoText: "Reina",
    type: "Tienda oficial museo",
    productRange:
      "Contemporary-art museum store whose products translate artworks, artists and the Reina Sofía identity into physical keepsakes. Categories include prints and postcards, stationery, ceramics, games, jewellery, textiles, accessories and museum-branded design products, with collections around artists and works such as Guernica, Dalí, Miró and Maruja Mallo. The shop is operated commercially by Palacios y Museos.",
    priceRange: "Postcards €2+\nMagnets €5+",
    contact: "tienda.reinasofia@palaciosymuseos.com",
    fit: "An Ambar Stamp could extend the Reina Sofía visit beyond the physical museum with a small collectible connected to the visit that unlocks selected artworks, stories and cultural recommendations digitally. Because the existing range is strongly artwork-led, a generic Madrid Stamp would likely be weaker than an exclusive Reina Sofía version.",
    address: "C. de Sta. Isabel, 52, Centro, 28012 Madrid",
    neighborhood: "",
    website: "https://tienda.museoreinasofia.es/",
    lat: 40.4081081,
    lng: -3.6935614,
  },
  {
    id: "caixaforum",
    name: "CaixaForum",
    category: "museum",
    initials: "CF",
    logoText: "Caixa",
    type: "Tienda oficial museo",
    productRange:
      "Bookstore and design shop specialising in contemporary art, photography, design and illustration. Its product assortment changes partly according to CaixaForum's exhibitions and includes books, exhibition publications, postcards, artist/design objects, cultural hobbies, stationery, audiovisual material and gift products. It therefore mixes exhibition-linked merchandising with a broader cultural-design assortment.",
    priceRange: "Books €15+\nMagnets €4+",
    contact: "comercial@laie.es",
    fit: "Good cultural/design fit with more flexibility than a traditional museum shop. Ambar could potentially work either as a Madrid cultural souvenir or through a CaixaForum-specific experience. Because Laie already combines exhibition products with independent design and cultural objects, this location is useful for testing whether Ambar can sit between a museum souvenir and a contemporary design gift.",
    address: "P.º del Prado, 36, Centro, 28014 Madrid",
    neighborhood: "",
    website: "https://caixaforum.org/es/madrid/info-centro",
    lat: 40.4111396,
    lng: -3.6935679,
  },
  {
    id: "el-prado",
    name: "El Prado",
    category: "museum",
    initials: "EP",
    logoText: "Prado",
    type: "Tienda oficial museo",
    productRange:
      "Prado's official retail offer is centred on books, catalogues and products inspired by the permanent collection and temporary exhibitions. The assortment includes prints, stationery, homeware, textiles, accessories, children's products, gifts and exclusive collaborations with designers, artisans and brands, all strongly linked to Prado artworks and visual identity. The museum states that its official commercial products are developed through Museo Nacional del Prado Difusión.",
    priceRange: "Postcards €2+\nPosters €10+\nBooks €20+",
    contact: "tiendaprado@museodelpradodifusion.es",
    fit: "High strategic potential but probably only through an exclusive Prado edition. An Ambar × Prado Stamp could function as a physical memory of the museum visit while unlocking a digital layer around selected masterpieces and nearby Madrid culture. Their strong emphasis on exclusive collection-inspired merchandise means the generic Madrid Stamp would be a substantially weaker proposition.",
    address: "Paseo del Prado, 28014 Madrid",
    neighborhood: "",
    website: "https://www.museodelprado.es/",
    lat: 40.4137925,
    lng: -3.6920407,
  },
];

export function getDirectionsUrl(shop: Shop) {
  const savedLocation = shop.directionsUrl?.trim() ?? "";
  if (/^https?:\/\//i.test(savedLocation)) return savedLocation;
  const destination = shop.address || savedLocation;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

export function makeInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  return (words.length === 1 ? words[0].slice(0, 3) : words.slice(0, 3).map((word) => word[0]).join(""))
    .toLocaleUpperCase("es")
    .slice(0, 3);
}

export function sortShops(items: Shop[]) {
  return [...items].sort((a, b) =>
    a.name.localeCompare(b.name, "es", { sensitivity: "base", numeric: true }),
  );
}
