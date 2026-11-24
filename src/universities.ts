// Selected teaching campuses in Greater London, including specialist institutions and London branch campuses.
// Pins use campus postcodes from the ONS Postcode Directory via Postcodes.io.
export const universities = [
  {name: "UCL · Bloomsbury", lat: 51.523571, lng: -0.132398},
  {name: "King’s College London · Strand", lat: 51.511613, lng: -0.116228},
  {name: "Imperial College London · South Kensington", lat: 51.499334, lng: -0.179178},
  {name: "Queen Mary University of London · Mile End", lat: 51.524637, lng: -0.040683},
  {name: "University of East London · Docklands", lat: 51.507567, lng: 0.063234},
  {name: "UCL East · One Pool Street", lat: 51.538485, lng: -0.009632},
  {name: "University of Greenwich", lat: 51.484468, lng: -0.003979},
  {name: "Goldsmiths, University of London", lat: 51.474144, lng: -0.035375},
  {name: "City St George’s · Clerkenwell", lat: 51.527903, lng: -0.103099},
  {name: "Middlesex University", lat: 51.589852, lng: -0.229002},
  {name: "University of West London · Ealing", lat: 51.50726, lng: -0.302991},
  {name: "Kingston University · Penrhyn Road", lat: 51.403273, lng: -0.303163},
  {name: "University of Roehampton", lat: 51.456694, lng: -0.243087},
  {name: "Brunel University of London", lat: 51.53284, lng: -0.472836},
  {name: "London South Bank University", lat: 51.498709, lng: -0.101747},
  {name: "University of Westminster · Marylebone", lat: 51.522025, lng: -0.154574},

  // WC2A 3LY · https://info.lse.ac.uk/staff/divisions/estates-division/lse-estate/lse-estate
  {name: "London School of Economics · Lincoln’s Inn Fields", lat: 51.515095, lng: -0.116891},
  // WC1H 0XG · https://www.soas.ac.uk/contacts
  {name: "SOAS University of London · Bloomsbury", lat: 51.522352, lng: -0.129234},
  // N1C 4AA · https://www.arts.ac.uk/colleges/central-saint-martins/about-us/museum-and-study-collection/visit
  {name: "University of the Arts London · Central Saint Martins", lat: 51.536141, lng: -0.124919},
  // N7 8DB · https://www.londonmet.ac.uk/contact-us/how-to-find-us/tower-building/graduate-centre/
  {name: "London Metropolitan University · Holloway", lat: 51.551473, lng: -0.110354},
  // WC1E 7JL · https://www.bbk.ac.uk/maps
  {name: "Birkbeck, University of London · Bloomsbury", lat: 51.52299, lng: -0.130317},
  // NW1 4SA · https://www.london.edu/about/our-campuses-and-locations/london
  {name: "London Business School · Regent’s Park", lat: 51.526583, lng: -0.161353},
  // WC1E 7HT · https://www.lshtm.ac.uk/aboutus/contact/keppel-street-location
  {name: "London School of Hygiene & Tropical Medicine", lat: 51.520927, lng: -0.130661},
  // SE10 0EW · https://www.ravensbourne.ac.uk/about-us/location
  {name: "Ravensbourne University London · Greenwich Peninsula", lat: 51.501677, lng: 0.005678},
  // TW1 4SX · https://www.stmarys.ac.uk/contact/directions.aspx
  {name: "St Mary’s University, Twickenham · Strawberry Hill", lat: 51.436151, lng: -0.335885},
  // NW1 0TU · https://www.rvc.ac.uk/about/our-campuses
  {name: "Royal Veterinary College · Camden", lat: 51.53683, lng: -0.133773},
  // SW11 4AN · https://www.rca.ac.uk/contact-us/
  {name: "Royal College of Art · Battersea", lat: 51.47963, lng: -0.169838},
  // SW7 2BS · https://venuehire.rcm.ac.uk/about-us/faqs/
  {name: "Royal College of Music · South Kensington", lat: 51.49928, lng: -0.176889},
  // EC2Y 8DT · https://www.gsmd.ac.uk/about-guildhall/visiting-guildhall-school
  {name: "Guildhall School of Music & Drama · Barbican", lat: 51.519519, lng: -0.092348},
  // SE8 3DZ · https://www.trinitylaban.ac.uk/about-us/visit-us/
  {name: "Trinity Laban Conservatoire · Deptford", lat: 51.479054, lng: -0.020388},
  // DA15 9DF · https://www.bruford.ac.uk/
  {name: "Rose Bruford College · Sidcup", lat: 51.439376, lng: 0.107096},
  // W14 9DA · https://www.lamda.ac.uk/about-us/your-visit/
  {name: "London Academy of Music & Dramatic Art · Barons Court", lat: 51.490552, lng: -0.213927},
  // E20 3BS · https://www.lborolondon.ac.uk/about/find-us/
  {name: "Loughborough University London · Here East", lat: 51.547645, lng: -0.024305},
  // E1 7JF · https://www.coventry.ac.uk/london/student-life/travelling-to-the-campus/
  {name: "Coventry University London · Liverpool Street", lat: 51.517948, lng: -0.078778},
  // E14 9GE · https://london.sunderland.ac.uk/about/our-london-campus
  {name: "University of Sunderland in London · Harbour Exchange", lat: 51.498934, lng: -0.015953},
  // E1W 1LP · https://www.nulondon.ac.uk/student-life/campus-facilities/devon-house/
  {name: "Northeastern University London · St Katharine Docks", lat: 51.506077, lng: -0.070517},
  // EC1Y 8HQ · https://www.law.ac.uk/locations/london/moorgate/
  {name: "University of Law · Moorgate", lat: 51.521704, lng: -0.089633},
  // W4 5AN · https://www.richmond.ac.uk/visit-the-campus/
  {name: "Richmond American University London · Chiswick Park", lat: 51.493215, lng: -0.274068},
  // SE1 9NN · https://www.bpp.com/about-bpp/locations/london-waterloo
  {name: "BPP University · Waterloo", lat: 51.505839, lng: -0.110615},
  // EC1A 4HD · https://www.aston.ac.uk/london/campus/location
  {name: "Aston University London · Aldersgate", lat: 51.517471, lng: -0.097507},
  // E17 9PH · https://myport-london.port.ac.uk/it-support-in-london
  {name: "University of Portsmouth London · Walthamstow", lat: 51.582878, lng: -0.017899},
];
