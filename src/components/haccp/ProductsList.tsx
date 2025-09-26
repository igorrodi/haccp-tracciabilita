import { useState } from "react";
import { Calendar, Package, Snowflake } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Mock data - verrà sostituito con dati da Supabase
const MOCK_PRODUCTS = [
  {
    id: "L.503586",
    category: "Salsiccia",
    originalLot: "ORIG-2024-001",
    productionDate: "2024-08-15",
    freezingDate: "2024-08-17",
    imageUrl: null,
    description: "Salsiccia fresca di suino, lavorata secondo tradizione",
    createdAt: "2024-08-15T10:30:00Z"
  },
  {
    id: "L.503587",
    category: "Stinchi",
    originalLot: "ORIG-2024-002",
    productionDate: "2024-08-16",
    freezingDate: null,
    imageUrl: null,
    description: "Stinchi di suino freschi",
    createdAt: "2024-08-16T09:15:00Z"
  },
  {
    id: "L.503588",
    category: "Salami di cervo",
    originalLot: "ORIG-2024-003",
    productionDate: "2024-08-14",
    freezingDate: "2024-08-20",
    imageUrl: null,
    description: "Salami di cervo stagionato, ricetta tradizionale",
    createdAt: "2024-08-14T14:20:00Z"
  }
];

export const ProductsList = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<typeof MOCK_PRODUCTS[0] | null>(null);

  const filteredProducts = MOCK_PRODUCTS.filter(product =>
    product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.originalLot.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT');
  };

  if (selectedProduct) {
    return (
      <Card className="haccp-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Dettagli Prodotto</CardTitle>
            <Button variant="outline" onClick={() => setSelectedProduct(null)}>
              Torna alla lista
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-2">{selectedProduct.category}</h3>
                <Badge variant="secondary" className="text-sm">
                  ID: {selectedProduct.id}
                </Badge>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Lotto originale:</span>
                  <span className="text-sm">{selectedProduct.originalLot}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Data produzione:</span>
                  <span className="text-sm">{formatDate(selectedProduct.productionDate)}</span>
                </div>
                
                {selectedProduct.freezingDate && (
                  <div className="flex items-center gap-2">
                    <Snowflake className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium">Data congelamento:</span>
                    <span className="text-sm">{formatDate(selectedProduct.freezingDate)}</span>
                  </div>
                )}
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Descrizione:</h4>
                <p className="text-sm text-muted-foreground">
                  {selectedProduct.description}
                </p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Etichetta originale:</h4>
                <div className="w-full h-48 bg-muted rounded-xl flex items-center justify-center">
                  <span className="text-muted-foreground">Nessuna immagine disponibile</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="haccp-card">
      <CardHeader>
        <CardTitle>Prodotti Registrati</CardTitle>
        <div className="flex gap-4">
          <Input
            placeholder="Cerca per categoria, lotto ID o lotto originale..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rounded-xl"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchTerm ? "Nessun prodotto trovato" : "Nessun prodotto registrato"}
              </p>
            </div>
          ) : (
            filteredProducts.map((product) => (
              <Card 
                key={product.id} 
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => setSelectedProduct(product)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{product.category}</h3>
                        <Badge variant="outline">{product.id}</Badge>
                        {product.freezingDate && (
                          <Badge variant="secondary" className="text-blue-600">
                            <Snowflake className="w-3 h-3 mr-1" />
                            Congelato
                          </Badge>
                        )}
                      </div>
                      
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div>Lotto originale: {product.originalLot}</div>
                        <div>Produzione: {formatDate(product.productionDate)}</div>
                        {product.freezingDate && (
                          <div>Congelamento: {formatDate(product.freezingDate)}</div>
                        )}
                      </div>
                    </div>
                    
                    <div className="w-16 h-16 bg-muted rounded-lg flex-shrink-0 ml-4">
                      {/* Miniatura etichetta */}
                      <div className="w-full h-full bg-muted rounded-lg flex items-center justify-center">
                        <Package className="w-6 h-6 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};