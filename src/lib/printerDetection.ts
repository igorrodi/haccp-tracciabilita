export interface DetectedPrinter {
  name: string;
  type: 'usb' | 'network' | 'browser';
  vendorId?: number;
  productId?: number;
  ipAddress?: string;
}

export const detectUSBPrinters = async (): Promise<DetectedPrinter[]> => {
  try {
    // Check if Web USB API is available
    if (!navigator.usb) {
      console.log('Web USB API not available');
      return [];
    }

    // Request USB devices
    const devices = await navigator.usb.getDevices();
    
    return devices.map((device) => ({
      name: device.productName || `USB Printer (${device.vendorId}:${device.productId})`,
      type: 'usb' as const,
      vendorId: device.vendorId,
      productId: device.productId,
    }));
  } catch (error) {
    console.error('Error detecting USB printers:', error);
    return [];
  }
};

export const requestUSBPrinter = async (): Promise<DetectedPrinter | null> => {
  try {
    if (!navigator.usb) {
      throw new Error('Web USB API non supportata dal browser');
    }

    // Request access to a USB printer
    // Filter for common printer class (7) or allow all devices
    const device = await navigator.usb.requestDevice({
      filters: [
        { classCode: 7 }, // Printer class
      ]
    });

    return {
      name: device.productName || `USB Printer (${device.vendorId}:${device.productId})`,
      type: 'usb',
      vendorId: device.vendorId,
      productId: device.productId,
    };
  } catch (error) {
    if ((error as Error).name === 'NotFoundError') {
      console.log('Nessuna stampante selezionata');
      return null;
    }
    console.error('Error requesting USB printer:', error);
    throw error;
  }
};

export const detectNetworkPrinters = async (ipRange?: string): Promise<DetectedPrinter[]> => {
  // Network printer detection would require backend support
  // For now, return empty array - user can manually enter IP
  console.log('Network printer detection requires manual IP entry');
  return [];
};

export const testPrinterConnection = async (printer: DetectedPrinter): Promise<boolean> => {
  try {
    if (printer.type === 'usb' && printer.vendorId && printer.productId) {
      if (!navigator.usb) {
        return false;
      }
      const devices = await navigator.usb.getDevices();
      const device = devices.find(
        d => d.vendorId === printer.vendorId && d.productId === printer.productId
      );
      return !!device;
    }
    return true; // For browser and network printers, assume available
  } catch (error) {
    console.error('Error testing printer connection:', error);
    return false;
  }
};