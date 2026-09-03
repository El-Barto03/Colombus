ALTER TABLE `shops` ADD `category` text DEFAULT 'shop' NOT NULL;
--> statement-breakpoint
INSERT INTO `shops` (
	`id`, `name`, `category`, `initials`, `logo_text`, `type`, `product_range`,
	`price_range`, `contact`, `fit`, `address`, `neighborhood`, `website`, `lat`, `lng`
) VALUES
(
	'el-escudo-de-toledo', 'El Escudo de Toledo', 'shop', 'ET', 'Escudo',
	'Artesanía & souvenir / gift shop',
	'Traditional gift and souvenir store close to Madrid''s main museum district, focused on Spanish craftsmanship and cultural keepsakes. Its assortment includes Madrid and Toledo souvenirs, Menina-inspired objects, heraldry and family crests, jewellery, decorative pieces and other traditional gift items. Public listings position it as more craftsmanship-led than a standard mass-tourist souvenir store',
	replace('Magnets €2\nPremium magnets €5+\nKeychains €7+\nPostcards €2+', '\n', char(10)),
	'escudotoledo@gmail.com',
	'Ambar could provide a contemporary contrast to its physical Madrid keepsakes, offering visitors a more interactive way to preserve their trip. Particularly useful for testing whether a digital-memory product can sit naturally alongside traditional Spanish souvenirs without feeling overly technological.',
	'Plaza Cánovas del Castillo 4, 28014 Madrid', '', '', 40.4146851, -3.6945994
),
(
	'thyssen-bornemisza-museo-nacional', 'Thyssen-Bornemisza Museo Nacional', 'museum', 'TB', 'Thyssen',
	'Tienda oficial museo',
	'Highly curated museum store built around the Thyssen collection, exhibitions and collaborations with external designers, artisans and brands. The assortment spans books, prints, stationery, ceramics, textiles, accessories, design objects and exclusive products that reinterpret works from the museum through contemporary design. The shop explicitly describes collaboration with brands and designers as part of its identity.',
	replace('Postcards €2+\nLamina €4\nPaper accessories €2+\nBooks €12 - €40\nPosters €10+\nHome accessories €15+ - €50', '\n', char(10)),
	'(Mamen Bustamante Navarro - Compras y Desarrollo de Producto) mbustamante@museothyssen.org',
	'The most natural fit would be an Ambar × Thyssen edition that turns the museum visit into a collectible memory and unlocks digital content connected to artworks, stories and recommendations. Their existing collaboration model makes this particularly relevant.',
	'Paseo del Prado, 8, 28014 Madrid', '', 'https://tienda.museothyssen.org/', 40.4162159, -3.6949317
),
(
	'reina-sofia', 'Reina Sofía', 'museum', 'RS', 'Reina',
	'Tienda oficial museo',
	'Contemporary-art museum store whose products translate artworks, artists and the Reina Sofía identity into physical keepsakes. Categories include prints and postcards, stationery, ceramics, games, jewellery, textiles, accessories and museum-branded design products, with collections around artists and works such as Guernica, Dalí, Miró and Maruja Mallo. The shop is operated commercially by Palacios y Museos.',
	replace('Postcards €2+\nMagnets €5+', '\n', char(10)),
	'tienda.reinasofia@palaciosymuseos.com',
	'An Ambar Stamp could extend the Reina Sofía visit beyond the physical museum with a small collectible connected to the visit that unlocks selected artworks, stories and cultural recommendations digitally. Because the existing range is strongly artwork-led, a generic Madrid Stamp would likely be weaker than an exclusive Reina Sofía version.',
	'C. de Sta. Isabel, 52, Centro, 28012 Madrid', '', 'https://tienda.museoreinasofia.es/', 40.4081081, -3.6935614
),
(
	'caixaforum', 'CaixaForum', 'museum', 'CF', 'Caixa',
	'Tienda oficial museo',
	'Bookstore and design shop specialising in contemporary art, photography, design and illustration. Its product assortment changes partly according to CaixaForum''s exhibitions and includes books, exhibition publications, postcards, artist/design objects, cultural hobbies, stationery, audiovisual material and gift products. It therefore mixes exhibition-linked merchandising with a broader cultural-design assortment.',
	replace('Books €15+\nMagnets €4+', '\n', char(10)),
	'comercial@laie.es',
	'Good cultural/design fit with more flexibility than a traditional museum shop. Ambar could potentially work either as a Madrid cultural souvenir or through a CaixaForum-specific experience. Because Laie already combines exhibition products with independent design and cultural objects, this location is useful for testing whether Ambar can sit between a museum souvenir and a contemporary design gift.',
	'P.º del Prado, 36, Centro, 28014 Madrid', '', 'https://caixaforum.org/es/madrid/info-centro', 40.4111396, -3.6935679
),
(
	'el-prado', 'El Prado', 'museum', 'EP', 'Prado',
	'Tienda oficial museo',
	'Prado''s official retail offer is centred on books, catalogues and products inspired by the permanent collection and temporary exhibitions. The assortment includes prints, stationery, homeware, textiles, accessories, children''s products, gifts and exclusive collaborations with designers, artisans and brands, all strongly linked to Prado artworks and visual identity. The museum states that its official commercial products are developed through Museo Nacional del Prado Difusión.',
	replace('Postcards €2+\nPosters €10+\nBooks €20+', '\n', char(10)),
	'tiendaprado@museodelpradodifusion.es',
	'High strategic potential but probably only through an exclusive Prado edition. An Ambar × Prado Stamp could function as a physical memory of the museum visit while unlocking a digital layer around selected masterpieces and nearby Madrid culture. Their strong emphasis on exclusive collection-inspired merchandise means the generic Madrid Stamp would be a substantially weaker proposition.',
	'Paseo del Prado, 28014 Madrid', '', 'https://www.museodelprado.es/', 40.4137925, -3.6920407
)
ON CONFLICT(`id`) DO UPDATE SET
	`name` = excluded.`name`,
	`category` = excluded.`category`,
	`initials` = excluded.`initials`,
	`logo_text` = excluded.`logo_text`,
	`type` = excluded.`type`,
	`product_range` = excluded.`product_range`,
	`price_range` = excluded.`price_range`,
	`contact` = excluded.`contact`,
	`fit` = excluded.`fit`,
	`address` = excluded.`address`,
	`website` = excluded.`website`,
	`lat` = excluded.`lat`,
	`lng` = excluded.`lng`,
	`updated_at` = CURRENT_TIMESTAMP;
