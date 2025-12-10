# Heart of Acheron Website

A professional, game-themed website for Heart of Acheron gaming server built with HTML, CSS, and JavaScript.

## Features

- 🎨 Dark fantasy game-like design with glowing effects
- 📱 Fully responsive and mobile-friendly
- 🎮 Professional gaming website aesthetic
- ⚡ Smooth animations and transitions
- 🛒 Interactive shop with category filtering
- 📧 Contact form with validation
- 🖼️ Organized image folder structure for easy asset management

## Getting Started

1. Open `index.html` in your web browser
2. That's it! No build process required.

## Project Structure

```
HoAWebsite/
├── index.html          # Home page
├── server-info.html    # Server information and connection details
├── shop.html           # Shop page (donations, items, perks)
├── contact.html        # Contact page with form
├── styles.css          # Main stylesheet with dark fantasy theme
├── script.js           # JavaScript functionality
├── images/             # Image assets folder
│   ├── logo/          # Logo files (place logo.png here)
│   ├── banners/       # Banner images (place hero-banner.jpg here)
│   ├── shop/          # Shop item images
│   └── backgrounds/    # Background images (place main-bg.jpg here)
└── README.md          # This file
```

## Adding Images

### Logo
- Place your logo file as `images/logo/logo.png`
- Recommended size: 200x50px or similar aspect ratio
- The logo will display in the header navigation

### Hero Banner
- Place your hero banner as `images/banners/hero-banner.jpg`
- Recommended size: 1920x1080px or similar
- This displays on the home page hero section

### Background Image
- Place your background image as `images/backgrounds/main-bg.jpg`
- Recommended size: 1920x1080px or larger
- This is used as the site-wide background

### Shop Item Images
- Place shop item images in `images/shop/`
- Name them according to the items (e.g., `item-supporter.jpg`, `item-weapon.jpg`)
- Recommended size: 400x300px or similar
- Images are referenced in `shop.html`

## Customization

### Colors
Edit the CSS variables in `styles.css`:
```css
:root {
    --primary-color: #6B2C91;      /* Purple - main brand color */
    --secondary-color: #D4AF37;    /* Gold - accents and highlights */
    --accent-red: #C41E3A;         /* Red - important elements */
    --dark-bg: #0a0a0a;            /* Dark background */
    /* ... */
}
```

### Server Information
Edit `server-info.html` to update:
- Server IP address and port
- Server status
- Connection instructions
- Server specifications

### Shop Items
Edit `shop.html` to:
- Add or remove products
- Update prices
- Modify product descriptions
- Add new categories

### Contact Information
Edit `contact.html` to update:
- Email addresses
- Discord links
- Social media links
- Response time information

## Pages

### Home (`index.html`)
- Hero section with banner
- Welcome message
- Feature highlights
- Quick links to other pages

### Server Information (`server-info.html`)
- Server status indicator
- Connection details with copy functionality
- Connection instructions
- Server specifications

### Shop (`shop.html`)
- Three product categories:
  - Donations/Support Packages
  - In-Game Items
  - Server Perks/Boosts
- Category filtering
- Product cards with images and pricing

### Contact (`contact.html`)
- Contact form
- Multiple contact methods
- Response time information

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Next Steps

Consider adding:
- Backend integration for the contact form
- Payment processing for shop items
- Server status API integration
- User accounts/login system
- Admin panel for managing shop items
- Blog or news section
- Discord widget integration

## Notes

- All image paths use placeholder references that will work once you add your images
- The website uses a dark fantasy theme with gold/purple color scheme
- All pages are fully responsive and work on mobile devices
- Navigation automatically highlights the current page

## License

This project is open source and available for personal use.
